import { SignIn, SignUp } from "@clerk/react";
import { shadcn } from "@clerk/themes";
import { useState, type FormEvent, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import {
  getGetProfileQueryKey,
  useUpdateProfile,
  type User,
} from "@workspace/api-client-react";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

export const authAppearance = {
  theme: shadcn,
  cssLayerName: "clerk",
  options: {
    logoPlacement: "inside" as const,
    logoLinkUrl: basePath || "/",
    logoImageUrl: `${window.location.origin}${basePath}/logo.svg`,
  },
  variables: {
    colorPrimary: "#247568",
    colorForeground: "#193640",
    colorMutedForeground: "#66827e",
    colorBackground: "#fbf9f4",
    colorInput: "#f1ede4",
    colorInputForeground: "#193640",
    colorNeutral: "#ded8cb",
    fontFamily: "DM Sans, sans-serif",
    borderRadius: "0.9rem",
  },
  elements: {
    rootBox: "w-full flex justify-center",
    cardBox: "bg-[#fbf9f4] rounded-[24px] w-[440px] max-w-full overflow-hidden",
    card: "!shadow-none !border-0 !bg-transparent !rounded-none",
    footer: "!shadow-none !border-0 !bg-transparent !rounded-none",
    headerTitle: "text-[#193640]",
    headerSubtitle: "text-[#66827e]",
    socialButtonsBlockButtonText: "text-[#193640]",
    formFieldLabel: "text-[#395555]",
    footerActionLink: "text-[#247568]",
    footerActionText: "text-[#66827e]",
    dividerText: "text-[#8b9791]",
    formButtonPrimary: "bg-[#247568] hover:bg-[#1d6257]",
    formFieldInput: "bg-[#f1ede4] border-[#ded8cb] text-[#193640]",
    socialButtonsBlockButton: "border-[#ded8cb] bg-[#fbf9f4]",
    main: "gap-4",
  },
};

export function SignInPage() {
  return (
    <AuthPageFrame eyebrow="Welcome back" title="Return to the room">
      <SignIn
        routing="path"
        path={`${basePath}/sign-in`}
        signUpUrl={`${basePath}/sign-up`}
        forceRedirectUrl={`${basePath}/`}
        fallbackRedirectUrl={`${basePath}/`}
        appearance={authAppearance}
      />
    </AuthPageFrame>
  );
}

export function SignUpPage() {
  return (
    <AuthPageFrame eyebrow="Join NexChat" title="Create your account">
      <SignUp
        routing="path"
        path={`${basePath}/sign-up`}
        signInUrl={`${basePath}/sign-in`}
        forceRedirectUrl={`${basePath}/`}
        fallbackRedirectUrl={`${basePath}/`}
        appearance={authAppearance}
      />
    </AuthPageFrame>
  );
}

function AuthPageFrame({
  eyebrow,
  title,
  children,
}: {
  eyebrow: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="noise min-h-[100dvh] bg-[#f3efe6] px-4 py-8 text-[#193640] sm:px-8">
      <div className="mx-auto flex min-h-[calc(100dvh-4rem)] max-w-6xl flex-col items-center justify-center gap-8 lg:flex-row lg:gap-20">
        <div className="max-w-sm text-center lg:text-left">
          <Link href="/" className="font-mono text-[10px] uppercase tracking-[.24em] text-[#66827e]">
            NexChat
          </Link>
          <p className="mt-12 font-mono text-[10px] uppercase tracking-[.2em] text-[#66827e]">
            {eyebrow}
          </p>
          <h1 className="mt-3 font-serif text-5xl leading-[.95] text-[#193640] sm:text-6xl">
            {title}
          </h1>
          <p className="mt-5 text-sm leading-6 text-[#71827d]">
            A calmer way to stay close to the people and conversations that matter.
          </p>
        </div>
        <div className="w-full max-w-[440px]">{children}</div>
      </div>
    </div>
  );
}

export function WelcomePage() {
  const [, setLocation] = useLocation();

  return (
    <main className="noise flex min-h-[100dvh] items-center justify-center bg-[#f3efe6] px-5 py-10 text-[#193640]">
      <section className="w-full max-w-5xl rounded-[30px] border border-[#ded8cb] bg-[#fbf9f4] p-7 shadow-[0_18px_60px_rgba(45,66,61,.08)] sm:p-12">
        <div className="flex flex-col justify-between gap-14 lg:flex-row lg:items-end">
          <div className="max-w-xl">
            <p className="font-mono text-[10px] uppercase tracking-[.24em] text-[#66827e]">NexChat</p>
            <h1 className="mt-5 font-serif text-6xl leading-[.9] text-[#193640] sm:text-8xl">
              Messages,
              <br />
              <span className="text-[#d88968]">with room</span>
              <br />
              to breathe.
            </h1>
            <p className="mt-7 max-w-md text-base leading-7 text-[#71827d]">
              Stay connected with your people in one thoughtful, easy-to-follow space.
            </p>
          </div>
          <div className="w-full max-w-xs">
            <p className="mb-4 text-sm font-medium text-[#395555]">Sign in to continue</p>
            <button
              onClick={() => setLocation("/sign-in")}
              className="flex h-12 w-full items-center justify-center rounded-xl bg-[#247568] text-sm font-semibold text-[#f7f5ec] transition-transform hover:-translate-y-0.5"
            >
              Continue with Google
            </button>
            <button
              onClick={() => setLocation("/sign-up")}
              className="mt-3 flex h-12 w-full items-center justify-center rounded-xl border border-[#b9cfc5] bg-transparent text-sm font-semibold text-[#247568] transition-colors hover:bg-[#eef4ee]"
            >
              Create an account
            </button>
            <p className="mt-5 text-xs leading-5 text-[#8b9791]">
              Your account keeps your profile and conversations available when you return.
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}

export function OnboardingPage({ user }: { user: User }) {
  const queryClient = useQueryClient();
  const updateProfile = useUpdateProfile();
  const [name, setName] = useState(user.name === "New member" ? "" : user.name);
  const [dateOfBirth, setDateOfBirth] = useState(user.dateOfBirth ?? "");
  const [error, setError] = useState("");

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (name.trim().length < 2 || !dateOfBirth) {
      setError("Please add your name and date of birth to continue.");
      return;
    }
    setError("");
    updateProfile.mutate(
      { data: { name: name.trim(), dateOfBirth } },
      {
        onSuccess: (profile) => {
          queryClient.setQueryData(getGetProfileQueryKey(), profile);
        },
        onError: () => setError("We couldn't save your profile. Please try again."),
      },
    );
  };

  return (
    <main className="noise flex min-h-[100dvh] items-center justify-center bg-[#f3efe6] px-5 py-10 text-[#193640]">
      <form onSubmit={submit} className="w-full max-w-lg rounded-[30px] border border-[#ded8cb] bg-[#fbf9f4] p-7 shadow-[0_18px_60px_rgba(45,66,61,.08)] sm:p-10">
        <p className="font-mono text-[10px] uppercase tracking-[.24em] text-[#66827e]">One last step</p>
        <h1 className="mt-4 font-serif text-5xl leading-none text-[#193640]">Make the room yours.</h1>
        <p className="mt-4 text-sm leading-6 text-[#71827d]">
          Add a couple of details so people know who they are talking with.
        </p>
        <label className="mt-8 block text-sm font-medium text-[#395555]">
          Your name
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            className="mt-2 h-12 w-full rounded-xl border border-[#ded8cb] bg-[#f1ede4] px-4 text-sm text-[#193640] outline-none focus:border-[#76b9a9] focus:ring-2 focus:ring-[#bfe2d6]"
            placeholder="How should people call you?"
            autoComplete="name"
            autoFocus
          />
        </label>
        <label className="mt-5 block text-sm font-medium text-[#395555]">
          Date of birth
          <input
            type="date"
            value={dateOfBirth}
            onChange={(event) => setDateOfBirth(event.target.value)}
            className="mt-2 h-12 w-full rounded-xl border border-[#ded8cb] bg-[#f1ede4] px-4 text-sm text-[#193640] outline-none focus:border-[#76b9a9] focus:ring-2 focus:ring-[#bfe2d6]"
            autoComplete="bday"
          />
        </label>
        {error && <p className="mt-4 text-sm text-[#bb5b4d]">{error}</p>}
        <button
          type="submit"
          disabled={updateProfile.isPending}
          className="mt-8 h-12 w-full rounded-xl bg-[#247568] text-sm font-semibold text-[#f7f5ec] transition-colors hover:bg-[#1d6257] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {updateProfile.isPending ? "Saving your profile…" : "Enter NexChat"}
        </button>
      </form>
    </main>
  );
}