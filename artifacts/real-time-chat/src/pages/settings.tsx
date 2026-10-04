import { type ReactNode, useEffect, useState } from 'react';
import { useClerk } from '@clerk/react';
import { ArrowLeft, Bell, Check, ChevronRight, LogOut, Moon, Shield, SlidersHorizontal, Volume2 } from 'lucide-react';
import { getGetProfileQueryKey, useGetProfile } from '@workspace/api-client-react';
import { Link } from 'wouter';
import { UserAvatar } from '@/components/chat-ui';
import { enableMessageNotifications } from '@/lib/push-notifications';

export default function SettingsPage() {
  const { signOut } = useClerk();
  const profile = useGetProfile({ query: { queryKey: getGetProfileQueryKey(), refetchInterval: 30000 } });
  const [sound, setSound] = useState(() => localStorage.getItem('commons-sound') !== 'off');
  const [compact, setCompact] = useState(() => localStorage.getItem('commons-compact') === 'on');
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [signOutError, setSignOutError] = useState('');
  const [notificationError, setNotificationError] = useState('');
  const [notificationsEnabled, setNotificationsEnabled] = useState(
    () => typeof Notification !== 'undefined' && Notification.permission === 'granted',
  );
  const [isEnablingNotifications, setIsEnablingNotifications] = useState(false);
  const handleEnableNotifications = async () => {
    setNotificationError('');
    setIsEnablingNotifications(true);
    try {
      await enableMessageNotifications();
      setNotificationsEnabled(true);
    } catch (error) {
      setNotificationError(
        error instanceof Error
          ? error.message
          : 'We could not enable message notifications. Please try again.',
      );
      setNotificationsEnabled(
        typeof Notification !== 'undefined' && Notification.permission === 'granted',
      );
    } finally {
      setIsEnablingNotifications(false);
    }
  };
  const handleSignOut = async () => {
    setIsSigningOut(true);
    setSignOutError('');
    try {
      await signOut({ redirectUrl: new URL(import.meta.env.BASE_URL, window.location.origin).toString() });
    } catch {
      setSignOutError('We could not sign you out. Please try again.');
      setIsSigningOut(false);
    }
  };
  const toggle = (key: string, value: boolean, setter: (next: boolean) => void) => {
    setter(!value);
    localStorage.setItem(key, !value ? 'on' : 'off');
  };
  useEffect(() => {
    document.title = 'Preferences · NexChat';
    return () => { document.title = 'NexChat'; };
  }, []);
  return <div className="noise min-h-[100dvh] bg-[#f3efe6] text-[#202c35]" data-testid="screen-settings">
    <header className="flex h-[78px] items-center justify-between border-b border-[#ddd8ce] bg-[#f8f5ee] px-5 sm:px-10"><Link href="/" className="flex items-center gap-2.5 text-sm font-semibold text-[#31555a]" data-testid="link-back-chat"><ArrowLeft size={17} /> Back to messages</Link><span className="font-mono text-[10px] uppercase tracking-[.22em] text-[#87958e]">NexChat</span></header>
    <main className="mx-auto max-w-3xl px-5 py-10 sm:px-10 sm:py-14"><div className="animate-rise"><p className="font-mono text-[10px] uppercase tracking-[.22em] text-[#679088]">Your space</p><h1 className="mt-2 font-serif text-4xl text-[#193640] sm:text-5xl">Preferences</h1><p className="mt-3 max-w-lg text-sm leading-6 text-[#7d8b86]">A few small choices to make the room feel like yours.</p></div>
      <section className="mt-10 rounded-[23px] border border-[#ded8ce] bg-[#fbf9f4] p-5 shadow-[0_6px_18px_rgba(45,66,61,.035)] sm:p-7" data-testid="profile-card"><div className="flex items-center gap-4"><UserAvatar name={profile.data?.name} initials={profile.data?.initials} color={profile.data?.avatarColor} size="lg" status={profile.data?.status} /><div className="min-w-0"><p className="truncate text-lg font-semibold text-[#284147]" data-testid="text-profile-name">{profile.data?.name || 'Your profile'}</p><p className="mt-0.5 text-sm text-[#87958e]" data-testid="text-profile-role">{profile.data?.role || 'Community member'}</p><span className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-[#e3efe8] px-2.5 py-1 text-[11px] font-medium text-[#4d806e]"><span className="h-1.5 w-1.5 rounded-full bg-[#7bbb9b]" />{profile.data?.status === 'online' ? 'Active now' : profile.data?.status || 'Available'}</span></div><button className="ml-auto hidden items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold text-[#4d8177] hover:bg-[#edf1eb] sm:flex" data-testid="button-edit-profile">Edit profile <ChevronRight size={14} /></button></div></section>
      <section className="mt-8" data-testid="preferences-section"><p className="font-mono text-[10px] uppercase tracking-[.2em] text-[#8d9992]">Preferences</p><div className="mt-3 divide-y divide-[#e7e1d7] rounded-[20px] border border-[#ded8ce] bg-[#fbf9f4]"><div><PreferenceRow icon={<Bell size={17} />} title="Notifications" description={notificationsEnabled ? "Message notifications are enabled on this device" : "Enable alerts when someone sends you a message"} trailing={<button type="button" onClick={() => void handleEnableNotifications()} disabled={isEnablingNotifications} className="rounded-lg border border-[#b9cfc5] px-3 py-2 text-xs font-semibold text-[#247568] transition-colors hover:bg-[#eef4ee] disabled:cursor-wait disabled:opacity-60" data-testid="button-enable-notifications">{isEnablingNotifications ? 'Enabling…' : notificationsEnabled ? 'Refresh' : 'Enable'}</button>} />{notificationError && <p className="px-5 pb-4 text-xs text-[#bb5b4d]" role="alert" data-testid="status-notifications-error">{notificationError}</p>}</div><PreferenceRow icon={<Volume2 size={17} />} title="Message sounds" description="A soft cue when something arrives" trailing={<Toggle checked={sound} onChange={() => toggle('commons-sound', sound, setSound)} label="Toggle message sounds" />} /><PreferenceRow icon={<SlidersHorizontal size={17} />} title="Compact messages" description="Fit a little more into the conversation" trailing={<Toggle checked={compact} onChange={() => toggle('commons-compact', compact, setCompact)} label="Toggle compact messages" />} /><PreferenceRow icon={<Moon size={17} />} title="Appearance" description="NexChat is in its warm day mode" trailing={<span className="text-xs text-[#8a9790]">Day</span>} /></div></section>
      <section className="mt-8" data-testid="privacy-section"><p className="font-mono text-[10px] uppercase tracking-[.2em] text-[#8d9992]">Trust & privacy</p><div className="mt-3 rounded-[20px] border border-[#ded8ce] bg-[#fbf9f4]"><PreferenceRow icon={<Shield size={17} />} title="Privacy & safety" description="Manage what you share with the community" trailing={<ChevronRight size={16} className="text-[#8c9c95]" />} /><PreferenceRow icon={<Check size={17} />} title="Read receipts" description="Let people know when you have seen a message" trailing={<span className="text-xs text-[#6c837d]">On</span>} /></div></section>
      <section className="mt-8" data-testid="account-section"><p className="font-mono text-[10px] uppercase tracking-[.2em] text-[#8d9992]">Account</p><div className="mt-3 rounded-[20px] border border-[#ded8ce] bg-[#fbf9f4]"><PreferenceRow icon={<LogOut size={17} />} title="Sign out" description="End your NexChat session on this device" trailing={<button type="button" onClick={() => void handleSignOut()} disabled={isSigningOut} className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold text-[#a85649] transition-colors hover:bg-[#f5e9e3] disabled:cursor-not-allowed disabled:opacity-60" data-testid="button-sign-out"><LogOut size={14} /> {isSigningOut ? 'Signing out…' : 'Sign out'}</button>} />{signOutError && <p className="px-5 pb-4 text-sm text-[#bb5b4d]" role="alert">{signOutError}</p>}</div></section>
      <p className="mt-8 text-center font-mono text-[10px] tracking-[.12em] text-[#abb0a8]">NexChat · made for staying in touch</p>
    </main>
  </div>;
}

function PreferenceRow({ icon, title, description, trailing }: { icon: ReactNode; title: string; description: string; trailing: ReactNode }) {
  return <div className="flex items-center gap-3.5 px-4 py-4 sm:px-5"><div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[#edf1eb] text-[#5c8c81]">{icon}</div><div className="min-w-0 flex-1"><p className="text-sm font-semibold text-[#3d5151]">{title}</p><p className="mt-0.5 truncate text-xs text-[#8a9690]">{description}</p></div>{trailing}</div>;
}

function Toggle({ checked, onChange, label }: { checked: boolean; onChange: () => void; label: string }) {
  return <button onClick={onChange} className={`relative h-6 w-11 rounded-full transition-colors ${checked ? 'bg-[#4d9889]' : 'bg-[#c7d0c9]'}`} aria-label={label} aria-pressed={checked} data-testid={`toggle-${label.toLowerCase().replaceAll(' ', '-')}`}><span className={`absolute top-1 h-4 w-4 rounded-full bg-[#fffaf1] shadow-sm transition-transform ${checked ? 'translate-x-6' : 'translate-x-1'}`} /></button>;
}