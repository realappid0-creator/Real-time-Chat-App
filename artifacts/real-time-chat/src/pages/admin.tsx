import { FormEvent, useState } from 'react';
import {
  Activity,
  AlertCircle,
  ArrowUpRight,
  Check,
  Clock3,
  Eye,
  LockKeyhole,
  LogOut,
  MessageCircle,
  MessagesSquare,
  RefreshCw,
  ShieldCheck,
  UserRound,
  UsersRound,
} from 'lucide-react';
import {
  getGetAdminOverviewQueryKey,
  getGetAdminSessionQueryKey,
  getListAdminConversationsQueryKey,
  getListAdminUsersQueryKey,
  useAdminLogin,
  useAdminLogout,
  useGetAdminOverview,
  useGetAdminSession,
  useListAdminConversations,
  useListAdminUsers,
  type AdminConversation,
  type AdminOverview,
  type User,
} from '@workspace/api-client-react';

const TEAL = '#164b4b';
const MUTED = '#718985';
const CORAL = '#df755f';

function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === 'string' && error) return error;
  return fallback;
}

function formatDate(value?: string | null, withDate = false) {
  if (!value) return 'No activity yet';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Recently';
  return new Intl.DateTimeFormat('en', {
    month: withDate ? 'short' : undefined,
    day: withDate ? 'numeric' : undefined,
    hour: 'numeric',
    minute: '2-digit',
  }).format(date);
}

function initialsFor(name: string, initials?: string) {
  if (initials) return initials.slice(0, 2).toUpperCase();
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase();
}

function Avatar({
  name,
  initials,
  color,
  size = 'md',
}: {
  name: string;
  initials?: string;
  color?: string;
  size?: 'sm' | 'md' | 'lg';
}) {
  const sizeClass = size === 'lg' ? 'h-12 w-12 text-sm' : size === 'sm' ? 'h-8 w-8 text-[10px]' : 'h-10 w-10 text-xs';
  return (
    <div
      className={`flex shrink-0 items-center justify-center rounded-full font-semibold tracking-[0.08em] ${sizeClass}`}
      style={{ backgroundColor: color || '#cfe1dc', color: color ? '#fffaf1' : TEAL }}
      aria-label={`${name} avatar`}
    >
      {initialsFor(name, initials)}
    </div>
  );
}

function LogoMark() {
  return (
    <div className="flex h-10 w-10 items-center justify-center rounded-[13px] bg-[#df755f] text-[#fffaf1] shadow-[0_8px_18px_rgba(223,117,95,.16)]">
      <MessagesSquare size={20} strokeWidth={2.3} />
    </div>
  );
}

function SectionHeading({
  eyebrow,
  title,
  count,
}: {
  eyebrow: string;
  title: string;
  count?: number;
}) {
  return (
    <div className="mb-5 flex items-end justify-between gap-4">
      <div>
        <p className="mb-1 font-mono text-[10px] font-medium uppercase tracking-[0.22em] text-[#a17869]">{eyebrow}</p>
        <h2 className="font-serif text-[25px] font-semibold leading-none text-[#164b4b]">{title}</h2>
      </div>
      {typeof count === 'number' && (
        <span className="rounded-full bg-[#edf0e7] px-2.5 py-1 font-mono text-[10px] text-[#718985]" data-testid={`text-count-${eyebrow.toLowerCase().replace(/\s+/g, '-')}`}>
          {count} total
        </span>
      )}
    </div>
  );
}

function QueryError({
  message,
  onRetry,
  testId,
}: {
  message: string;
  onRetry: () => void;
  testId: string;
}) {
  return (
    <div className="flex min-h-[180px] flex-col items-center justify-center rounded-[18px] border border-dashed border-[#e6b6a8] bg-[#fff7ee] p-6 text-center" data-testid={testId}>
      <AlertCircle size={20} className="mb-2 text-[#c65f50]" />
      <p className="mb-1 text-sm font-semibold text-[#164b4b]">This view is taking a moment</p>
      <p className="mb-4 max-w-xs text-xs leading-5 text-[#718985]">{message}</p>
      <button
        type="button"
        onClick={onRetry}
        className="inline-flex items-center gap-2 rounded-full border border-[#d4ded3] bg-[#fffaf1] px-3.5 py-2 text-xs font-semibold text-[#164b4b] transition hover:border-[#df755f] hover:text-[#c65f50]"
        data-testid={`button-retry-${testId}`}
      >
        <RefreshCw size={13} /> Try again
      </button>
    </div>
  );
}

function SkeletonRows({ count = 3 }: { count?: number }) {
  return (
    <div className="space-y-3" aria-label="Loading">
      {Array.from({ length: count }).map((_, index) => (
        <div className="flex items-center gap-3" key={index}>
          <div className="animate-pulse rounded-full bg-[#e5e6dc] h-10 w-10" />
          <div className="min-w-0 flex-1 space-y-2">
            <div className="h-3 w-1/3 animate-pulse rounded-full bg-[#e5e6dc]" />
            <div className="h-2.5 w-2/3 animate-pulse rounded-full bg-[#ecece4]" />
          </div>
        </div>
      ))}
    </div>
  );
}

function EmptyState({ icon: Icon, title, detail }: { icon: typeof MessageCircle; title: string; detail: string }) {
  return (
    <div className="flex min-h-[168px] flex-col items-center justify-center rounded-[16px] bg-[#f7f4eb] px-5 text-center">
      <Icon size={22} strokeWidth={1.6} className="mb-3 text-[#a1b1a6]" />
      <p className="text-sm font-semibold text-[#164b4b]">{title}</p>
      <p className="mt-1 max-w-[230px] text-xs leading-5 text-[#718985]">{detail}</p>
    </div>
  );
}

function LoginView({
  sessionError,
  onAuthenticated,
}: {
  sessionError: boolean;
  onAuthenticated: () => void;
}) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState('');

  const login = useAdminLogin({
    mutation: {
      onSuccess: () => {
        setLoginError('');
        onAuthenticated();
      },
      onError: (error) => {
        setLoginError(getErrorMessage(error, 'Those credentials did not work. Check them and try again.'));
      },
    },
  });

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoginError('');
    login.mutate({ data: { username: username.trim(), password } });
  };

  return (
    <main className="noise flex min-h-[100dvh] items-center justify-center overflow-hidden bg-[#f3efe6] px-5 py-8 text-[#164b4b]">
      <div className="pointer-events-none absolute -left-24 -top-32 h-80 w-80 rounded-full bg-[#d9e9de] opacity-60 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-40 -right-20 h-96 w-96 rounded-full bg-[#f2d5c7] opacity-55 blur-3xl" />
      <div className="relative grid w-full max-w-[1040px] overflow-hidden rounded-[28px] border border-[#dedfd3] bg-[#fffaf1] shadow-[0_28px_80px_rgba(35,74,69,.12)] md:grid-cols-[.88fr_1.12fr]">
        <section className="relative flex min-h-[300px] flex-col justify-between overflow-hidden bg-[#174f4d] p-8 text-[#f8f2e7] md:p-11">
          <div className="absolute -right-24 -top-20 h-64 w-64 rounded-full border border-[#8eb8a8]/25" />
          <div className="absolute -right-8 -top-4 h-32 w-32 rounded-full border border-[#8eb8a8]/20" />
          <div className="relative flex items-center gap-3">
            <LogoMark />
            <div>
              <p className="font-serif text-[22px] font-semibold tracking-[-0.03em]">NexChat</p>
              <p className="font-mono text-[9px] uppercase tracking-[0.22em] text-[#a9c5b7]">Private operations</p>
            </div>
          </div>
          <div className="relative mt-12 max-w-[300px] md:mt-0">
            <p className="mb-4 font-mono text-[10px] uppercase tracking-[0.2em] text-[#a9c5b7]">A quieter way to keep watch</p>
            <h1 className="font-serif text-[39px] font-semibold leading-[1.04] tracking-[-0.035em]">Make space for the conversations that matter.</h1>
            <p className="mt-5 max-w-[260px] text-sm leading-6 text-[#c3d6ca]">A small window into the people, rooms, and moments shaping NexChat.</p>
          </div>
          <div className="relative mt-10 flex items-center gap-2 text-xs text-[#a9c5b7] md:mt-0">
            <ShieldCheck size={14} />
            <span>Trusted team access only</span>
          </div>
        </section>

        <section className="flex items-center p-7 sm:p-10 md:p-14">
          <div className="w-full max-w-[390px]">
            <div className="mb-9">
              <p className="mb-3 font-mono text-[10px] font-medium uppercase tracking-[0.2em] text-[#a17869]">Admin console</p>
              <h2 className="font-serif text-[34px] font-semibold leading-none tracking-[-0.03em] text-[#164b4b]">Welcome back.</h2>
              <p className="mt-3 text-sm leading-6 text-[#718985]">Sign in to see what is happening across NexChat.</p>
            </div>

            {sessionError && (
              <div className="mb-5 flex gap-2.5 rounded-xl border border-[#e7d3bd] bg-[#fcf5e9] p-3 text-xs leading-5 text-[#876e5c]" data-testid="status-session-error">
                <AlertCircle size={15} className="mt-0.5 shrink-0 text-[#c65f50]" />
                <span>We could not confirm an existing session. Sign in to continue.</span>
              </div>
            )}
            {loginError && (
              <div className="mb-5 flex gap-2.5 rounded-xl border border-[#e6b6a8] bg-[#fff3ed] p-3 text-xs leading-5 text-[#a14f44]" role="alert" data-testid="status-login-error">
                <AlertCircle size={15} className="mt-0.5 shrink-0" />
                <span>{loginError}</span>
              </div>
            )}

            <form className="space-y-5" onSubmit={handleSubmit}>
              <label className="block">
                <span className="mb-2 block text-xs font-semibold text-[#164b4b]">Username</span>
                <div className="relative">
                  <UserRound size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[#9aaca3]" />
                  <input
                    autoComplete="username"
                    className="h-12 w-full rounded-xl border border-[#d8dfd5] bg-[#fdfbf5] pl-10 pr-4 text-sm text-[#164b4b] outline-none transition placeholder:text-[#aab8b0] focus:border-[#4c8b7e] focus:ring-2 focus:ring-[#c9e0d5]"
                    data-testid="input-admin-username"
                    onChange={(event) => setUsername(event.target.value)}
                    placeholder="Your admin username"
                    required
                    value={username}
                  />
                </div>
              </label>
              <label className="block">
                <span className="mb-2 block text-xs font-semibold text-[#164b4b]">Password</span>
                <div className="relative">
                  <LockKeyhole size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[#9aaca3]" />
                  <input
                    autoComplete="current-password"
                    className="h-12 w-full rounded-xl border border-[#d8dfd5] bg-[#fdfbf5] pl-10 pr-4 text-sm text-[#164b4b] outline-none transition placeholder:text-[#aab8b0] focus:border-[#4c8b7e] focus:ring-2 focus:ring-[#c9e0d5]"
                    data-testid="input-admin-password"
                    onChange={(event) => setPassword(event.target.value)}
                    placeholder="Your password"
                    required
                    type="password"
                    value={password}
                  />
                </div>
              </label>
              <button
                className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#df755f] text-sm font-bold text-[#fffaf1] shadow-[0_8px_18px_rgba(223,117,95,.19)] transition hover:bg-[#cc6855] disabled:cursor-not-allowed disabled:opacity-60"
                data-testid="button-admin-login"
                disabled={login.isPending}
                type="submit"
              >
                {login.isPending ? 'Checking access…' : 'Enter console'}
                {!login.isPending && <ArrowUpRight size={16} />}
              </button>
            </form>
            <p className="mt-8 flex items-center justify-center gap-2 font-mono text-[10px] uppercase tracking-[0.12em] text-[#9aaca3]">
              <LockKeyhole size={12} /> Encrypted session
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}

function MetricRail({ overview }: { overview: AdminOverview }) {
  return (
    <div className="grid overflow-hidden rounded-[18px] border border-[#dbe1d7] bg-[#fffaf1] sm:grid-cols-[1.15fr_1fr_1fr]">
      <div className="bg-[#df755f] p-5 text-[#fffaf1] sm:p-6">
        <div className="mb-7 flex items-center justify-between">
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-[#ffe5da]">Messages exchanged</p>
          <MessageCircle size={17} className="text-[#ffe5da]" />
        </div>
        <p className="font-serif text-[38px] font-semibold leading-none tracking-[-0.035em]" data-testid="metric-message-count">{overview.messageCount.toLocaleString()}</p>
        <p className="mt-2 text-xs text-[#ffe5da]">All time across NexChat</p>
      </div>
      <div className="border-t border-[#dbe1d7] p-5 sm:border-l sm:border-t-0 sm:p-6">
        <div className="mb-7 flex items-center justify-between">
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-[#a17869]">People</p>
          <UsersRound size={17} className="text-[#87a39a]" />
        </div>
        <p className="font-serif text-[38px] font-semibold leading-none tracking-[-0.035em] text-[#164b4b]" data-testid="metric-user-count">{overview.userCount.toLocaleString()}</p>
        <p className="mt-2 text-xs text-[#718985]">Registered members</p>
      </div>
      <div className="border-t border-[#dbe1d7] p-5 sm:border-l sm:border-t-0 sm:p-6">
        <div className="mb-7 flex items-center justify-between">
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-[#a17869]">Conversations</p>
          <MessagesSquare size={17} className="text-[#87a39a]" />
        </div>
        <p className="font-serif text-[38px] font-semibold leading-none tracking-[-0.035em] text-[#164b4b]" data-testid="metric-conversation-count">{overview.conversationCount.toLocaleString()}</p>
        <p className="mt-2 text-xs text-[#718985]">Rooms with a pulse</p>
      </div>
    </div>
  );
}

function RecentActivity({
  overview,
  loading,
  error,
  onRetry,
}: {
  overview?: AdminOverview;
  loading: boolean;
  error: boolean;
  onRetry: () => void;
}) {
  return (
    <section className="rounded-[20px] border border-[#dbe1d7] bg-[#fffaf1] p-5 sm:p-6">
      <SectionHeading eyebrow="Live window" title="Recent messages" />
      {loading ? <SkeletonRows count={4} /> : error ? <QueryError message="Recent activity could not be loaded." onRetry={onRetry} testId="error-recent-messages" /> : overview?.recentMessages?.length ? (
        <div className="divide-y divide-[#e9e9df]">
          {overview.recentMessages.map((message) => (
            <div className="group flex gap-3.5 py-4 first:pt-0 last:pb-0" data-testid={`row-message-${message.id}`} key={message.id}>
              <Avatar name={message.senderName} size="sm" />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                  <p className="truncate text-sm font-semibold text-[#164b4b]" data-testid={`text-message-sender-${message.id}`}>{message.senderName}</p>
                  <time className="shrink-0 font-mono text-[10px] text-[#9aaca3]" dateTime={message.sentAt}>{formatDate(message.sentAt, true)}</time>
                </div>
                <p className="mt-1 line-clamp-2 text-xs leading-5 text-[#718985]" data-testid={`text-message-body-${message.id}`}>{message.body}</p>
                <p className="mt-2 flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-[0.1em] text-[#a17869]">
                  <MessagesSquare size={11} /> {message.conversationName}
                </p>
              </div>
            </div>
          ))}
        </div>
      ) : <EmptyState icon={MessageCircle} title="A quiet window" detail="New messages will appear here as people find their way into conversation." />}
    </section>
  );
}

function UsersPanel({
  users,
  loading,
  error,
  onRetry,
}: {
  users?: User[];
  loading: boolean;
  error: boolean;
  onRetry: () => void;
}) {
  return (
    <section className="rounded-[20px] border border-[#dbe1d7] bg-[#fffaf1] p-5 sm:p-6">
      <SectionHeading eyebrow="People" title="Users" count={users?.length} />
      {loading ? <SkeletonRows count={4} /> : error ? <QueryError message="The people directory could not be loaded." onRetry={onRetry} testId="error-users" /> : users?.length ? (
        <div className="space-y-1">
          {users.map((user) => (
            <div className="flex items-center gap-3 rounded-xl px-2 py-2.5 transition hover:bg-[#f7f4eb]" data-testid={`row-user-${user.id}`} key={user.id}>
              <Avatar color={user.avatarColor} initials={user.initials} name={user.name} size="sm" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-[#164b4b]" data-testid={`text-user-name-${user.id}`}>{user.name}</p>
                <p className="truncate text-xs text-[#8a9b94]">{user.email || user.role || 'NexChat member'}</p>
              </div>
              <div className="flex items-center gap-1.5 text-[10px] font-medium capitalize text-[#718985]" data-testid={`status-user-${user.id}`}>
                <span className={`h-1.5 w-1.5 rounded-full ${user.status === 'online' ? 'bg-[#6ea98c]' : user.status === 'away' ? 'bg-[#d6a266]' : 'bg-[#b6c2ba]'}`} />
                {user.status}
              </div>
            </div>
          ))}
        </div>
      ) : <EmptyState icon={UsersRound} title="No users yet" detail="People will appear here after they create a NexChat account." />}
    </section>
  );
}

function ConversationsPanel({
  conversations,
  loading,
  error,
  onRetry,
}: {
  conversations?: AdminConversation[];
  loading: boolean;
  error: boolean;
  onRetry: () => void;
}) {
  return (
    <section className="rounded-[20px] border border-[#dbe1d7] bg-[#fffaf1] p-5 sm:p-6">
      <SectionHeading eyebrow="Rooms" title="Conversations" count={conversations?.length} />
      {loading ? <SkeletonRows count={4} /> : error ? <QueryError message="The conversation list could not be loaded." onRetry={onRetry} testId="error-conversations" /> : conversations?.length ? (
        <div className="space-y-1">
          {conversations.map((conversation) => (
            <div className="flex items-center gap-3 rounded-xl px-2 py-2.5 transition hover:bg-[#f7f4eb]" data-testid={`row-conversation-${conversation.id}`} key={conversation.id}>
              <Avatar color={conversation.avatarColor} name={conversation.name} size="sm" />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="truncate text-sm font-semibold text-[#164b4b]" data-testid={`text-conversation-name-${conversation.id}`}>{conversation.name}</p>
                  {conversation.pinned && <span className="font-mono text-[9px] uppercase tracking-[0.1em] text-[#c87964]">Pinned</span>}
                </div>
                <p className="mt-0.5 truncate text-xs text-[#8a9b94]">{conversation.lastMessageBody || 'No messages yet'}</p>
              </div>
              <div className="shrink-0 text-right">
                <p className="font-mono text-[10px] text-[#9aaca3]">{formatDate(conversation.lastMessageAt)}</p>
                <p className="mt-1 text-[10px] text-[#a17869]">{conversation.memberCount} {conversation.memberCount === 1 ? 'member' : 'members'}</p>
              </div>
            </div>
          ))}
        </div>
      ) : <EmptyState icon={MessagesSquare} title="No conversations yet" detail="When a room is opened, its pulse will be visible here." />}
    </section>
  );
}

function AdminConsole({
  onLogout,
}: {
  onLogout: () => void;
}) {
  const [logoutError, setLogoutError] = useState('');
  const overview = useGetAdminOverview({
    query: {
      enabled: true,
      queryKey: getGetAdminOverviewQueryKey(),
      refetchInterval: 30000,
    },
  });
  const users = useListAdminUsers({
    query: { enabled: true, queryKey: getListAdminUsersQueryKey() },
  });
  const conversations = useListAdminConversations({
    query: { enabled: true, queryKey: getListAdminConversationsQueryKey() },
  });
  const logout = useAdminLogout({
    mutation: {
      onSuccess: () => {
        setLogoutError('');
        onLogout();
      },
      onError: (error) => setLogoutError(getErrorMessage(error, 'We could not end the session. Please try again.')),
    },
  });

  const isLoading = overview.isLoading || users.isLoading || conversations.isLoading;
  const hasFirstLoadError = overview.isError && users.isError && conversations.isError;

  return (
    <main className="noise min-h-[100dvh] bg-[#f3efe6] text-[#164b4b]">
      <header className="border-b border-[#dce2d7] bg-[#f8f5ec]/90 backdrop-blur">
        <div className="mx-auto flex max-w-[1280px] items-center justify-between gap-4 px-5 py-4 sm:px-8 lg:px-10">
          <div className="flex items-center gap-3">
            <LogoMark />
            <div>
              <p className="font-serif text-[21px] font-semibold leading-none tracking-[-0.03em]">NexChat</p>
              <p className="mt-1 font-mono text-[9px] uppercase tracking-[0.2em] text-[#8aa098]">Admin console</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="hidden items-center gap-1.5 rounded-full border border-[#d7e2d7] bg-[#f0f6ed] px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.12em] text-[#547e6e] sm:flex">
              <span className="h-1.5 w-1.5 rounded-full bg-[#6ea98c]" /> Read only
            </span>
            <button
              className="inline-flex items-center gap-2 rounded-full border border-[#d5ddd3] bg-[#fffaf1] px-3.5 py-2 text-xs font-semibold text-[#164b4b] transition hover:border-[#df755f] hover:text-[#c65f50] disabled:cursor-not-allowed disabled:opacity-60"
              data-testid="button-admin-logout"
              disabled={logout.isPending}
              onClick={() => {
                setLogoutError('');
                logout.mutate();
              }}
              type="button"
            >
              <LogOut size={14} /> {logout.isPending ? 'Leaving…' : 'Log out'}
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-[1280px] px-5 pb-12 pt-9 sm:px-8 lg:px-10 lg:pt-12">
        <div className="mb-8 flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
          <div>
            <p className="mb-3 flex items-center gap-2 font-mono text-[10px] font-medium uppercase tracking-[0.2em] text-[#a17869]">
              <Activity size={13} /> Operations / overview
            </p>
            <h1 className="font-serif text-[39px] font-semibold leading-none tracking-[-0.04em] text-[#164b4b] sm:text-[47px]" data-testid="heading-admin-console">A considered view of NexChat.</h1>
            <p className="mt-3 max-w-[520px] text-sm leading-6 text-[#718985]">People, rooms, and the latest notes — kept close enough to understand, never too loud to distract.</p>
          </div>
          <div className="flex items-center gap-2 text-xs text-[#8a9b94]" data-testid="status-refresh">
            <Clock3 size={14} /> Updates every 30 seconds
          </div>
        </div>

        {logoutError && (
          <div className="mb-5 flex items-center gap-2 rounded-xl border border-[#e6b6a8] bg-[#fff3ed] px-4 py-3 text-xs text-[#a14f44]" role="alert" data-testid="status-logout-error">
            <AlertCircle size={15} /> {logoutError}
          </div>
        )}
        {hasFirstLoadError && (
          <div className="mb-5 flex items-center justify-between gap-4 rounded-xl border border-[#e6b6a8] bg-[#fff3ed] px-4 py-3 text-xs text-[#a14f44]" role="alert" data-testid="status-admin-load-error">
            <span className="flex items-center gap-2"><AlertCircle size={15} /> The console could not reach the operations data.</span>
            <button className="font-semibold underline underline-offset-2" onClick={() => { void overview.refetch(); void users.refetch(); void conversations.refetch(); }} type="button" data-testid="button-retry-admin-data">Retry</button>
          </div>
        )}

        {overview.isLoading ? (
          <div className="grid gap-4 sm:grid-cols-3" data-testid="loading-admin-overview">
            <div className="h-[156px] animate-pulse rounded-[18px] bg-[#e6e7dc] sm:col-span-1" />
            <div className="h-[156px] animate-pulse rounded-[18px] bg-[#ecece3]" />
            <div className="h-[156px] animate-pulse rounded-[18px] bg-[#ecece3]" />
          </div>
        ) : overview.data ? (
          <MetricRail overview={overview.data} />
        ) : overview.isError ? (
          <QueryError message="Overview metrics could not be loaded." onRetry={() => void overview.refetch()} testId="error-admin-overview" />
        ) : null}

        <div className="mt-8 grid gap-5 lg:grid-cols-[1.08fr_.92fr]">
          <RecentActivity overview={overview.data} loading={overview.isLoading} error={overview.isError} onRetry={() => void overview.refetch()} />
          <section className="relative overflow-hidden rounded-[20px] bg-[#174f4d] p-6 text-[#f8f2e7] sm:p-7">
            <div className="absolute -right-14 -top-20 h-52 w-52 rounded-full border border-[#a9c5b7]/20" />
            <div className="relative flex h-full flex-col justify-between">
              <div>
                <p className="mb-6 flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.2em] text-[#a9c5b7]"><Eye size={14} /> A private note</p>
                <h2 className="max-w-[340px] font-serif text-[30px] font-semibold leading-[1.08] tracking-[-0.03em]">The best signals are often quiet.</h2>
                <p className="mt-4 max-w-[350px] text-sm leading-6 text-[#c3d6ca]">Use this space to notice rhythms: a new room finding its shape, a familiar name returning, a conversation that needs a little more room.</p>
              </div>
              <div className="mt-10 border-t border-[#6f9d91]/40 pt-4">
                <p className="flex items-center gap-2 text-xs text-[#a9c5b7]"><Check size={14} /> Private, read-only access</p>
              </div>
            </div>
          </section>
        </div>

        <div className="mt-5 grid gap-5 lg:grid-cols-2">
          <UsersPanel users={users.data} loading={users.isLoading} error={users.isError} onRetry={() => void users.refetch()} />
          <ConversationsPanel conversations={conversations.data} loading={conversations.isLoading} error={conversations.isError} onRetry={() => void conversations.refetch()} />
        </div>

        {isLoading && <span className="sr-only" data-testid="status-admin-loading">Loading console data</span>}
      </div>
    </main>
  );
}

export default function AdminPage() {
  const session = useGetAdminSession({
    query: { queryKey: getGetAdminSessionQueryKey() },
  });
  const [authOverride, setAuthOverride] = useState<boolean | null>(null);
  const authenticated = authOverride ?? Boolean(session.data?.authenticated);

  if (session.isLoading && authOverride === null) {
    return (
      <main className="flex min-h-[100dvh] items-center justify-center bg-[#f3efe6] p-6">
        <div className="w-full max-w-[420px] space-y-4" data-testid="loading-admin-session">
          <div className="mx-auto h-12 w-12 animate-pulse rounded-[15px] bg-[#d8e6dd]" />
          <div className="mx-auto h-5 w-44 animate-pulse rounded-full bg-[#e3e5db]" />
          <div className="mx-auto h-3 w-64 animate-pulse rounded-full bg-[#e9e9e1]" />
        </div>
      </main>
    );
  }

  if (!authenticated) {
    return <LoginView onAuthenticated={() => setAuthOverride(true)} sessionError={session.isError} />;
  }

  return <AdminConsole onLogout={() => setAuthOverride(false)} />;
}