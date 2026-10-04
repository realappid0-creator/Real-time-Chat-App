import { type ReactNode, useEffect, useRef } from 'react';
import { ClerkProvider, useAuth, useClerk } from '@clerk/react';
import { publishableKeyFromHost } from '@clerk/react/internal';
import { authAppearance, OnboardingPage, SignInPage, SignUpPage, WelcomePage } from '@/pages/auth';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useQueryClient } from '@tanstack/react-query';
import { ErrorBoundary } from '@/components/error-boundary';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import { useToast } from '@/hooks/use-toast';
import { ChatWorkspace } from '@/components/chat-ui';
import NotFound from '@/pages/not-found';
import SettingsPage from '@/pages/settings';
import AdminPage from '@/pages/admin';
import { getGetProfileQueryKey, setAuthTokenGetter, setBaseUrl, useGetProfile } from '@workspace/api-client-react';
import {
  Redirect,
  Route,
  Switch,
  useLocation,
  Router as WouterRouter,
} from 'wouter';

const queryClient = new QueryClient();
const basePath = import.meta.env.BASE_URL.replace(/\/$/, '');
const lastMessageActivityStorageKey = 'nexchat:last-message-activity';
const messageActivityEvent = 'nexchat:message-activity';
setBaseUrl(import.meta.env.VITE_API_BASE_URL || null);
const clerkPubKey = publishableKeyFromHost(
  window.location.hostname,
  import.meta.env.VITE_CLERK_PUBLISHABLE_KEY,
);
const clerkProxyUrl = import.meta.env.VITE_CLERK_PROXY_URL;

if (!clerkPubKey) {
  throw new Error('Missing VITE_CLERK_PUBLISHABLE_KEY in .env file');
}

function stripBase(path: string) {
  return basePath && path.startsWith(basePath)
    ? path.slice(basePath.length) || '/'
    : path;
}

function LoadingScreen() {
  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-[#f3efe6] text-sm text-[#66827e]">
      Opening your room…
    </div>
  );
}

function RootRoute() {
  const { isLoaded, isSignedIn } = useAuth();
  if (!isLoaded) return <LoadingScreen />;
  if (!isSignedIn) return <WelcomePage />;
  return <AuthenticatedHome />;
}

function AuthenticatedHome() {
  const profile = useGetProfile({
    query: { queryKey: getGetProfileQueryKey(), refetchInterval: 30000 },
  });

  if (profile.isLoading) return <LoadingScreen />;
  if (profile.isError || !profile.data) {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center bg-[#f3efe6] text-sm text-[#bb5b4d]">
        We couldn’t load your profile. Please refresh and try again.
      </div>
    );
  }
  if (profile.data.needsOnboarding) return <OnboardingPage user={profile.data} />;
  return <ChatWorkspace />;
}

function ProtectedRoute({ children }: { children: ReactNode }) {
  const { isLoaded, isSignedIn } = useAuth();
  if (!isLoaded) return <LoadingScreen />;
  if (!isSignedIn) return <Redirect to="/" />;
  return <>{children}</>;
}

function Router() {
  return (
    // Keep a shared shell (sidebar, navbar) outside the boundary so it
    // survives a page crash.
    <RoutedErrorBoundary>
      <Switch>
         <Route path="/" component={RootRoute} />
         <Route path="/settings">
           <ProtectedRoute><SettingsPage /></ProtectedRoute>
         </Route>
          <Route path="/admin" component={AdminPage} />
         <Route path="/sign-in/*?" component={SignInPage} />
         <Route path="/sign-up/*?" component={SignUpPage} />
        <Route component={NotFound} />
      </Switch>
    </RoutedErrorBoundary>
  );
}

function RoutedErrorBoundary({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  return <ErrorBoundary resetKey={location}>{children}</ErrorBoundary>;
}

function ClerkQueryClientCacheInvalidator() {
  const { addListener } = useClerk();
  const queryClient = useQueryClient();
  const previousUserId = useRef<string | null | undefined>(undefined);

  useEffect(() => {
    const unsubscribe = addListener(({ user }) => {
      const userId = user?.id ?? null;
      if (
        previousUserId.current !== undefined &&
        previousUserId.current !== userId
      ) {
        queryClient.clear();
      }
      previousUserId.current = userId;
    });
    return unsubscribe;
  }, [addListener, queryClient]);

  return null;
}

function ClerkApiTokenBridge() {
  const { getToken } = useAuth();

  useEffect(() => {
    setAuthTokenGetter(() => getToken());
    return () => setAuthTokenGetter(null);
  }, [getToken]);

  return null;
}

function PushNotificationBridge() {
  const { toast } = useToast();

  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    const handlePushMessage = (event: MessageEvent<{
      type?: string;
      title?: string;
      body?: string;
    }>) => {
      if (event.data?.type !== "NEXCHAT_PUSH_MESSAGE") return;
      window.dispatchEvent(new Event(messageActivityEvent));
      toast({
        title: event.data.title ?? "New message",
        description: event.data.body ?? "You have a new message",
      });
    };

    navigator.serviceWorker.addEventListener("message", handlePushMessage);
    return () =>
      navigator.serviceWorker.removeEventListener("message", handlePushMessage);
  }, [toast]);

  return null;
}

function InactivitySignOut() {
  const { isLoaded, isSignedIn } = useAuth();
  const { signOut } = useClerk();
  const signOutStarted = useRef(false);

  useEffect(() => {
    if (!isLoaded) {
      return;
    }
    if (!isSignedIn) {
      signOutStarted.current = false;
      try {
        window.localStorage.removeItem(lastMessageActivityStorageKey);
      } catch {
        // The next signed-in session initializes its timer in memory.
      }
      return;
    }

    const configuredMinutes = Number(import.meta.env.VITE_INACTIVITY_TIMEOUT_MINUTES);
    const timeoutMinutes = Number.isFinite(configuredMinutes) && configuredMinutes > 0
      ? configuredMinutes
      : 30;
    const timeoutMs = timeoutMinutes * 60 * 1000;
    let timeoutId: number;

    const signOutForInactivity = () => {
      if (signOutStarted.current) return;
      signOutStarted.current = true;
      void signOut({
        redirectUrl: new URL(`${basePath}/sign-in`, window.location.origin).toString(),
      }).catch((error) => {
        signOutStarted.current = false;
        console.error('Could not end the inactive session', error);
      });
    };

    const scheduleTimeout = (lastActivity: number) => {
      window.clearTimeout(timeoutId);
      const remainingMs = Math.max(0, timeoutMs - (Date.now() - lastActivity));
      timeoutId = window.setTimeout(signOutForInactivity, remainingMs);
    };
    const recordMessageActivity = () => {
      const lastActivity = Date.now();
      try {
        window.localStorage.setItem(lastMessageActivityStorageKey, String(lastActivity));
      } catch {
        // The current tab's timer still works when browser storage is unavailable.
      }
      scheduleTimeout(lastActivity);
    };
    const handleOtherTabActivity = (event: StorageEvent) => {
      if (event.key !== lastMessageActivityStorageKey || !event.newValue) return;
      const lastActivity = Number(event.newValue);
      if (Number.isFinite(lastActivity)) scheduleTimeout(lastActivity);
    };
    let storedLastActivity = Number.NaN;
    try {
      storedLastActivity = Number(
        window.localStorage.getItem(lastMessageActivityStorageKey),
      );
    } catch {
      // The current tab's timer still works when browser storage is unavailable.
    }
    if (Number.isFinite(storedLastActivity) && storedLastActivity > 0) {
      scheduleTimeout(storedLastActivity);
    } else {
      recordMessageActivity();
    }
    window.addEventListener(messageActivityEvent, recordMessageActivity);
    window.addEventListener('storage', handleOtherTabActivity);

    return () => {
      window.clearTimeout(timeoutId);
      window.removeEventListener(messageActivityEvent, recordMessageActivity);
      window.removeEventListener('storage', handleOtherTabActivity);
    };
  }, [isLoaded, isSignedIn, signOut]);

  return null;
}

function App() {
  return (
    <WouterRouter base={basePath}>
      <ClerkProviderWithRoutes />
    </WouterRouter>
  );
}

function ClerkProviderWithRoutes() {
  const [, setLocation] = useLocation();

  return (
    <ClerkProvider
      publishableKey={clerkPubKey}
      proxyUrl={clerkProxyUrl}
      appearance={authAppearance}
      signInForceRedirectUrl={`${basePath}/`}
      signUpForceRedirectUrl={`${basePath}/`}
      signInUrl={`${basePath}/sign-in`}
      signUpUrl={`${basePath}/sign-up`}
      localization={{
        signIn: {
          start: {
            title: 'Sign in to NexChat',
            subtitle: 'Welcome back! Please sign in to continue',
          },
        },
        signUp: {
          start: {
            title: 'Create your NexChat account',
            subtitle: 'Join the conversation',
          },
        },
      }}
      routerPush={(to) => setLocation(stripBase(to))}
      routerReplace={(to) => setLocation(stripBase(to), { replace: true })}
    >
      <QueryClientProvider client={queryClient}>
        <ClerkApiTokenBridge />
        <ClerkQueryClientCacheInvalidator />
        <PushNotificationBridge />
        <InactivitySignOut />
        <TooltipProvider>
          <Router />
          <Toaster />
        </TooltipProvider>
      </QueryClientProvider>
    </ClerkProvider>
  );
}

export default App;
