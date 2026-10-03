import { useEffect, useMemo, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  Bell,
  Check,
  CheckCheck,
  ChevronDown,
  Circle,
  Inbox,
  Menu,
  MessageCircle,
  MoreHorizontal,
  Paperclip,
  Pin,
  Plus,
  Search,
  Send,
  Settings,
  Smile,
  Sparkles,
  Users,
  X,
} from 'lucide-react';
import {
  getGetProfileQueryKey,
  getListConversationsQueryKey,
  getListMessagesQueryKey,
  getListUsersQueryKey,
  useCreateConversation,
  useGetProfile,
  useListConversations,
  useListMessages,
  useListPresence,
  useListUsers,
  useSendMessage,
  type Conversation,
  type Message,
  type User,
} from '@workspace/api-client-react';
import { Link, useLocation } from 'wouter';

const avatarTones = ['#d88968', '#5b9e99', '#9f7dba', '#d2a34d', '#6e8fb1'];

function initialsFor(name?: string, initials?: string) {
  if (initials) return initials.slice(0, 2).toUpperCase();
  return (name ?? '??').split(' ').map((part) => part[0]).join('').slice(0, 2).toUpperCase();
}

export function UserAvatar({
  name,
  initials,
  color,
  size = 'md',
  status,
}: {
  name?: string;
  initials?: string;
  color?: string;
  size?: 'sm' | 'md' | 'lg';
  status?: string;
}) {
  const sizes = { sm: 'h-8 w-8 text-[10px]', md: 'h-10 w-10 text-xs', lg: 'h-12 w-12 text-sm' };
  return (
    <div className={`relative shrink-0 ${sizes[size]}`} data-testid={`avatar-${name ?? 'user'}`}>
      <div
        className="flex h-full w-full items-center justify-center rounded-[13px] font-semibold text-[#fff8ed] shadow-sm"
        style={{ backgroundColor: color || avatarTones[1] }}
      >
        {initialsFor(name, initials)}
      </div>
      {status && (
        <span
          aria-label={status}
          className={`absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-[#fbf8f1] ${
            status === 'online' ? 'bg-[#80c7a7]' : status === 'away' ? 'bg-[#e5b35e]' : 'bg-[#a8aaa9]'
          }`}
        />
      )}
    </div>
  );
}

function timeLabel(value?: string | null) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.valueOf())) return '';
  const today = new Date();
  if (date.toDateString() === today.toDateString()) {
    return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  }
  return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

function messageTime(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.valueOf()) ? '' : date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

function participantPreview(conversation: Conversation) {
  if (conversation.kind === 'group') return `${conversation.participants.length} people`;
  return conversation.participants[0]?.status === 'online' ? 'Online now' : 'Away for a bit';
}

function statusText(status?: string) {
  if (status === 'online') return 'Active now';
  if (status === 'away') return 'Away';
  return 'Offline';
}

export function ChatWorkspace() {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [mobileListOpen, setMobileListOpen] = useState(true);
  const [search, setSearch] = useState('');
  const [newConversationOpen, setNewConversationOpen] = useState(false);
  const [location, setLocation] = useLocation();
  const profile = useGetProfile({ query: { queryKey: getGetProfileQueryKey(), refetchInterval: 30000 } });
  const presence = useListPresence({ query: { queryKey: ['/api/presence'], refetchInterval: 10000 } });
  const conversations = useListConversations({
    query: { queryKey: getListConversationsQueryKey(), refetchInterval: 12000 },
  });
  const hasInvalidConversationData =
    conversations.data !== undefined && !Array.isArray(conversations.data);
  const list = Array.isArray(conversations.data) ? conversations.data : [];
  const filtered = useMemo(
    () =>
      list.filter((conversation) =>
        conversation.name.toLowerCase().includes(search.trim().toLowerCase()),
      ),
    [list, search],
  );
  const selected = list.find((conversation) => conversation.id === selectedId) ?? filtered[0] ?? list[0];
  const activePresence = presence.data?.find((item) => item.userId === selected?.participants[0]?.id);

  useEffect(() => {
    if (!selectedId && list[0]) setSelectedId(list[0].id);
  }, [list, selectedId]);

  useEffect(() => {
    if (location === '/settings') return;
    if (location !== '/' && location !== '') setLocation('/');
  }, [location, setLocation]);

  const selectConversation = (id: string) => {
    setSelectedId(id);
    setMobileListOpen(false);
  };

  return (
    <div className="noise flex min-h-[100dvh] overflow-hidden bg-[#f3efe6] text-[#202c35]" data-testid="screen-chat">
      <aside className="hidden w-[76px] shrink-0 flex-col items-center justify-between bg-[#193640] py-6 text-[#d9e6dd] md:flex">
        <div className="flex flex-col items-center gap-8">
          <div className="grid h-10 w-10 place-items-center rounded-[14px] bg-[#83c9b1] text-[#193640]" data-testid="brand-mark">
            <MessageCircle size={20} strokeWidth={2.5} />
          </div>
          <div className="flex flex-col items-center gap-4">
            <button className="grid h-10 w-10 place-items-center rounded-xl bg-[#2a4a54] text-[#a9dcca]" aria-label="Conversations" data-testid="button-open-conversations">
              <Inbox size={18} />
            </button>
            <button className="grid h-10 w-10 place-items-center rounded-xl text-[#93a9a9] transition-colors hover:bg-[#2a4a54] hover:text-[#d9e6dd]" aria-label="People" data-testid="button-open-people">
              <Users size={18} />
            </button>
          </div>
        </div>
        <div className="flex flex-col items-center gap-4">
          <Link href="/settings" className="grid h-10 w-10 place-items-center rounded-xl text-[#93a9a9] transition-colors hover:bg-[#2a4a54] hover:text-[#d9e6dd]" aria-label="Settings" data-testid="link-settings">
            <Settings size={18} />
          </Link>
          <UserAvatar name={profile.data?.name} initials={profile.data?.initials} color={profile.data?.avatarColor} size="sm" status={profile.data?.status} />
        </div>
      </aside>

      <section className={`${mobileListOpen ? 'flex' : 'hidden'} w-full shrink-0 flex-col border-r border-[#ded8cb] bg-[#f8f5ee] md:flex md:w-[330px] xl:w-[360px]`} data-testid="conversation-list-panel">
        <div className="px-5 pb-5 pt-7">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-mono text-[10px] uppercase tracking-[.22em] text-[#66827e]">NexChat</p>
              <h1 className="mt-1 font-serif text-[27px] leading-none text-[#193640]">Messages</h1>
            </div>
            <button
              onClick={() => setNewConversationOpen(true)}
              className="grid h-9 w-9 place-items-center rounded-xl bg-[#e9a482] text-[#193640] transition-transform hover:-translate-y-0.5"
              aria-label="Start a new conversation"
              data-testid="button-new-conversation"
            >
              <Plus size={18} />
            </button>
          </div>
          <label className="mt-6 flex h-10 items-center gap-2 rounded-xl border border-[#e3ddd2] bg-[#f1ede4] px-3 text-[#80908c] focus-within:border-[#76b9a9] focus-within:ring-2 focus-within:ring-[#bfe2d6]">
            <Search size={16} />
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search conversations" className="min-w-0 flex-1 bg-transparent text-sm text-[#26373c] outline-none placeholder:text-[#9da6a0]" aria-label="Search conversations" data-testid="input-search-conversations" />
            {search && <button onClick={() => setSearch('')} aria-label="Clear search" data-testid="button-clear-search"><X size={14} /></button>}
          </label>
        </div>
        <div className="flex items-center justify-between px-5 pb-2">
          <span className="font-mono text-[10px] uppercase tracking-[.18em] text-[#8b9791]">Your conversations</span>
          <span className="text-xs text-[#9ba39e]" data-testid="text-conversation-count">{filtered.length}</span>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-4">
          {conversations.isLoading && <ConversationSkeletons />}
          {(conversations.isError || hasInvalidConversationData) && <InlineError label="We couldn't load your threads." onRetry={() => conversations.refetch()} />}
          {!conversations.isLoading && !conversations.isError && !hasInvalidConversationData && filtered.length === 0 && (
            <EmptyConversations search={search} onStart={() => setNewConversationOpen(true)} />
          )}
          <div className="space-y-1">
            {filtered.map((conversation, index) => (
              <ConversationRow key={conversation.id} conversation={conversation} selected={conversation.id === selected?.id} onSelect={() => selectConversation(conversation.id)} index={index} />
            ))}
          </div>
        </div>
        <div className="border-t border-[#e2ddd4] px-5 py-4 md:hidden">
          <Link href="/settings" className="flex items-center gap-3 text-sm text-[#4f6666]" data-testid="link-settings-mobile">
            <Settings size={16} /> Preferences
          </Link>
        </div>
      </section>

      <main className={`${mobileListOpen ? 'hidden' : 'flex'} min-w-0 flex-1 flex-col bg-[#fbf9f4] md:flex`} data-testid="active-conversation-panel">
        {selected ? (
          <ActiveConversation
            conversation={selected}
            profile={profile.data}
            presenceStatus={activePresence?.status ?? selected.participants[0]?.status}
            onBack={() => setMobileListOpen(true)}
          />
        ) : (
          <WorkspaceEmpty onStart={() => setNewConversationOpen(true)} />
        )}
      </main>
      {newConversationOpen && <NewConversationDialog currentUserId={profile.data?.id} onClose={() => setNewConversationOpen(false)} onCreated={(conversation) => { setNewConversationOpen(false); setSelectedId(conversation.id); setMobileListOpen(false); }} />}
    </div>
  );
}

function ConversationRow({ conversation, selected, onSelect, index }: { conversation: Conversation; selected: boolean; onSelect: () => void; index: number }) {
  const participant = conversation.participants[0];
  const tone = conversation.avatarColor || participant?.avatarColor || avatarTones[index % avatarTones.length];
  return (
    <button onClick={onSelect} className={`animate-rise group flex w-full items-center gap-3 rounded-[15px] px-3 py-3 text-left transition-colors ${selected ? 'bg-[#e6eee8]' : 'hover:bg-[#f0ece4]'}`} style={{ animationDelay: `${index * 35}ms` }} data-testid={`button-conversation-${conversation.id}`}>
      <UserAvatar name={conversation.name} initials={conversation.kind === 'group' ? undefined : participant?.initials} color={tone} size="md" status={conversation.kind === 'direct' ? participant?.status : undefined} />
      <span className="min-w-0 flex-1">
        <span className="flex items-center justify-between gap-2">
          <span className={`truncate text-sm ${conversation.unreadCount ? 'font-semibold text-[#193640]' : 'font-medium text-[#39494c]'}`} data-testid={`text-conversation-name-${conversation.id}`}>{conversation.name}</span>
          <span className="shrink-0 font-mono text-[10px] text-[#9aa39d]">{timeLabel(conversation.lastMessage?.sentAt)}</span>
        </span>
        <span className="mt-1 flex items-center justify-between gap-2">
          <span className={`truncate text-xs ${conversation.unreadCount ? 'font-medium text-[#526967]' : 'text-[#8c9690]'}`}>{conversation.lastMessage?.body || participantPreview(conversation)}</span>
          <span className="flex shrink-0 items-center gap-1.5">
            {conversation.pinned && <Pin size={11} className="text-[#9aab9f]" />}
            {conversation.muted && <Bell size={11} className="text-[#9aab9f]" />}
            {!!conversation.unreadCount && <span className="grid h-5 min-w-5 place-items-center rounded-full bg-[#e9a482] px-1.5 font-mono text-[10px] font-medium text-[#193640]" data-testid={`badge-unread-${conversation.id}`}>{conversation.unreadCount}</span>}
          </span>
        </span>
      </span>
    </button>
  );
}

function ConversationSkeletons() {
  return <div className="space-y-2 px-2">{[1, 2, 3, 4].map((item) => <div key={item} className="flex gap-3 rounded-xl px-2 py-3"><div className="h-10 w-10 animate-soft-pulse rounded-[13px] bg-[#e8e1d6]" /><div className="flex-1 space-y-2 pt-1"><div className="h-3 w-2/3 animate-soft-pulse rounded bg-[#e8e1d6]" /><div className="h-2.5 w-5/6 animate-soft-pulse rounded bg-[#eee8de]" /></div></div>)}</div>;
}

function InlineError({ label, onRetry }: { label: string; onRetry: () => void }) {
  return <div className="m-2 rounded-xl border border-[#eccbc0] bg-[#fff3ed] p-4 text-sm text-[#8d5547]" data-testid="status-conversation-error"><p>{label}</p><button onClick={onRetry} className="mt-2 font-semibold underline underline-offset-2" data-testid="button-retry-conversations">Try again</button></div>;
}

function EmptyConversations({ search, onStart }: { search: string; onStart: () => void }) {
  return <div className="px-4 py-16 text-center" data-testid="empty-conversations"><div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-[#e6eee8] text-[#4c8f82]"><Search size={19} /></div><p className="mt-4 text-sm font-semibold text-[#3b5050]">{search ? 'No conversations match that search' : 'Your inbox is quiet'}</p><p className="mt-1 text-xs leading-5 text-[#87948e]">{search ? 'Try another name or phrase.' : 'Start a conversation when you are ready.'}</p>{!search && <button onClick={onStart} className="mt-5 text-xs font-semibold text-[#338375] underline underline-offset-4" data-testid="button-empty-start">New conversation</button>}</div>;
}

function WorkspaceEmpty({ onStart }: { onStart: () => void }) {
  return <div className="flex min-h-full flex-col items-center justify-center px-6 text-center"><div className="relative grid h-20 w-20 place-items-center rounded-[27px] bg-[#e5eee7] text-[#4d9587]"><MessageCircle size={31} strokeWidth={1.5} /><span className="absolute -right-1 top-0 h-3 w-3 rounded-full bg-[#e9a482]" /></div><h2 className="mt-6 font-serif text-3xl text-[#193640]">Make room for a good conversation.</h2><p className="mt-2 max-w-sm text-sm leading-6 text-[#7c8985]">Choose a conversation from the left, or start one with someone from your community.</p><button onClick={onStart} className="mt-7 flex items-center gap-2 rounded-xl bg-[#193640] px-4 py-2.5 text-sm font-semibold text-[#f8f5ee] transition-transform hover:-translate-y-0.5" data-testid="button-workspace-start"><Plus size={16} /> New conversation</button></div>;
}

function ActiveConversation({ conversation, profile, presenceStatus, onBack }: { conversation: Conversation; profile?: User; presenceStatus?: string; onBack: () => void }) {
  const [replyTo, setReplyTo] = useState<Message | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const messages = useListMessages(conversation.id, { query: { enabled: !!conversation.id, queryKey: getListMessagesQueryKey(conversation.id), refetchInterval: 6000 } });
  const queryClient = useQueryClient();
  const sendMessage = useSendMessage();
  const endRef = useRef<HTMLDivElement>(null);
  const [draft, setDraft] = useState('');
  const senderId = profile?.id;

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.data?.length]);

  const submit = () => {
    const body = draft.trim();
    if (!body || sendMessage.isPending) return;
    sendMessage.mutate({ conversationId: conversation.id, data: { body } }, {
      onSuccess: (message) => {
        queryClient.setQueryData<Message[]>(getListMessagesQueryKey(conversation.id), (old) => [...(old ?? []), message]);
        queryClient.invalidateQueries({ queryKey: getListConversationsQueryKey() });
        setDraft('');
        setReplyTo(null);
      },
    });
  };
  const items = messages.data ?? [];
  const participant = conversation.participants[0];
  const tone = conversation.avatarColor || participant?.avatarColor || avatarTones[1];

  return (
    <>
      <header className="flex min-h-[78px] items-center justify-between border-b border-[#e3ded5] bg-[#fbf9f4] px-4 sm:px-7">
        <div className="flex min-w-0 items-center gap-3">
          <button onClick={onBack} className="grid h-9 w-9 shrink-0 place-items-center rounded-xl text-[#667875] hover:bg-[#f0ece3] md:hidden" aria-label="Back to conversations" data-testid="button-back-conversations"><ArrowLeft size={18} /></button>
          <UserAvatar name={conversation.name} initials={conversation.kind === 'direct' ? participant?.initials : undefined} color={tone} size="md" status={conversation.kind === 'direct' ? presenceStatus : undefined} />
          <div className="min-w-0">
            <h2 className="truncate text-[15px] font-semibold text-[#193640]" data-testid="text-active-conversation">{conversation.name}</h2>
            <p className="mt-0.5 flex items-center gap-1.5 text-xs text-[#7b8d87]" data-testid="status-active-conversation"><span className={`h-1.5 w-1.5 rounded-full ${presenceStatus === 'online' ? 'bg-[#76bc9a]' : 'bg-[#d7a961]'}`} />{conversation.kind === 'group' ? `${conversation.participants.length} participants` : statusText(presenceStatus)}</p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button className="hidden h-9 items-center gap-2 rounded-xl px-3 text-xs font-medium text-[#71827d] hover:bg-[#f0ece3] sm:flex" data-testid="button-conversation-search"><Search size={16} /> Search</button>
          <button onClick={() => setDetailsOpen((value) => !value)} className={`grid h-9 w-9 place-items-center rounded-xl text-[#71827d] hover:bg-[#f0ece3] ${detailsOpen ? 'bg-[#edf1eb] text-[#328071]' : ''}`} aria-label="Conversation details" data-testid="button-conversation-details"><MoreHorizontal size={18} /></button>
        </div>
      </header>
      <div className="relative min-h-0 flex-1">
        <div className="absolute inset-0 overflow-y-auto px-4 py-7 sm:px-8 lg:px-16 xl:px-24" data-testid="message-list">
          {messages.isLoading && <MessageSkeletons />}
          {messages.isError && <div className="mx-auto mt-10 max-w-sm rounded-2xl border border-[#ead8cd] bg-[#fff5ed] p-5 text-center text-sm text-[#8d6253]" data-testid="status-message-error"><p>Messages took a wrong turn.</p><button onClick={() => messages.refetch()} className="mt-2 font-semibold underline underline-offset-2" data-testid="button-retry-messages">Reload messages</button></div>}
          {!messages.isLoading && !messages.isError && items.length === 0 && <div className="mx-auto flex max-w-md flex-col items-center py-20 text-center" data-testid="empty-messages"><div className="grid h-14 w-14 place-items-center rounded-2xl bg-[#e8efea] text-[#428b7c]"><Sparkles size={21} /></div><p className="mt-5 font-serif text-2xl text-[#193640]">A fresh page</p><p className="mt-1 text-sm text-[#89938e]">Say hello and start the thread.</p></div>}
          {items.length > 0 && <div className="mx-auto max-w-3xl"><div className="mb-8 flex items-center justify-center gap-3 text-[10px] font-medium uppercase tracking-[.18em] text-[#a3aaa3]"><span className="h-px flex-1 bg-[#e7e1d7]" />Today<span className="h-px flex-1 bg-[#e7e1d7]" /></div>{items.map((message, index) => <MessageBubble key={message.id} message={message} own={message.senderId === senderId} onReply={() => setReplyTo(message)} grouped={index > 0 && items[index - 1].senderId === message.senderId} />)}<div ref={endRef} /></div>}
        </div>
        {detailsOpen && <ConversationDetails conversation={conversation} onClose={() => setDetailsOpen(false)} />}
      </div>
      <div className="border-t border-[#e5e0d7] bg-[#fbf9f4] px-4 pb-5 pt-3 sm:px-8 lg:px-16 xl:px-24">
        {replyTo && <div className="mx-auto mb-2 flex max-w-3xl items-center gap-2 rounded-xl bg-[#edf2ec] px-3 py-2 text-xs text-[#57706a]" data-testid="reply-preview"><span className="h-5 w-0.5 rounded bg-[#63a899]" /><span className="min-w-0 flex-1 truncate"><strong>Replying to {replyTo.senderName}</strong> · {replyTo.body}</span><button onClick={() => setReplyTo(null)} aria-label="Cancel reply" data-testid="button-cancel-reply"><X size={14} /></button></div>}
        <div className="mx-auto flex max-w-3xl items-end gap-2 rounded-2xl border border-[#dedbd2] bg-[#f6f3eb] p-2 shadow-[0_5px_18px_rgba(47,67,62,.04)] focus-within:border-[#8cc9b8] focus-within:ring-2 focus-within:ring-[#d7eee5]">
          <button className="mb-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-xl text-[#84938e] hover:bg-[#e8e6dd] hover:text-[#357e73]" aria-label="Attach a file" data-testid="button-attach-file"><Paperclip size={17} /></button>
          <textarea value={draft} onChange={(event) => setDraft(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); submit(); } }} rows={1} placeholder="Write something..." className="max-h-28 min-h-9 flex-1 resize-none bg-transparent px-1 py-2 text-sm leading-5 text-[#32454a] outline-none placeholder:text-[#98a29d]" aria-label="Message" data-testid="input-message" />
          <button className="mb-0.5 hidden h-9 w-9 shrink-0 place-items-center rounded-xl text-[#84938e] hover:bg-[#e8e6dd] hover:text-[#357e73] sm:grid" aria-label="Add a reaction" data-testid="button-add-reaction"><Smile size={17} /></button>
          <button onClick={submit} disabled={!draft.trim() || sendMessage.isPending} className="mb-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[#247568] text-[#f7f5ec] transition-transform hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-35" aria-label="Send message" data-testid="button-send-message"><Send size={16} /></button>
        </div>
        <p className="mx-auto mt-2 hidden max-w-3xl text-[10px] text-[#abb0a8] sm:block">Press Enter to send <span className="px-1">·</span> Shift + Enter for a new line</p>
      </div>
    </>
  );
}

function MessageBubble({ message, own, onReply, grouped }: { message: Message; own: boolean; onReply: () => void; grouped: boolean }) {
  return <div className={`group relative flex ${own ? 'justify-end' : 'justify-start'} ${grouped ? 'mt-1' : 'mt-5'} animate-rise`} data-testid={`message-${message.id}`}>
    {!own && !grouped && <UserAvatar name={message.senderName} initials={message.senderInitials} size="sm" color={avatarTones[2]} />}
    <div className={`max-w-[82%] sm:max-w-[70%] ${!own && !grouped ? 'ml-3' : ''}`}>
      {!own && !grouped && <div className="mb-1 flex items-center gap-2 px-1"><span className="text-xs font-semibold text-[#536a67]">{message.senderName}</span><span className="font-mono text-[10px] text-[#adb1a9]">{messageTime(message.sentAt)}</span></div>}
      <div className={`relative rounded-2xl px-4 py-2.5 text-sm leading-6 ${own ? 'rounded-br-md bg-[#d9eee5] text-[#29483f]' : 'rounded-bl-md bg-[#f0ece4] text-[#435458]'}`}>
        {message.replyTo && <div className="mb-2 border-l-2 border-[#84b9aa] pl-2 text-xs text-[#6f817b]"><span className="font-semibold">{message.replyTo.senderName}</span><br /><span className="line-clamp-1">{message.replyTo.body}</span></div>}
        <p className="whitespace-pre-wrap break-words">{message.body}</p>
        <div className={`mt-1 flex items-center justify-end gap-1.5 ${own ? 'text-[#6e9d8f]' : 'text-[#a4aaa3]'}`}><span className="font-mono text-[10px]">{messageTime(message.sentAt)}</span>{own && (message.status === 'read' ? <CheckCheck size={13} /> : message.status === 'delivered' ? <CheckCheck size={13} /> : <Check size={13} />)}</div>
        <button onClick={onReply} className="absolute -top-3 right-2 hidden h-7 w-7 place-items-center rounded-lg border border-[#dedbd1] bg-[#fbf9f4] text-[#71918a] shadow-sm group-hover:grid" aria-label="Reply to message" data-testid={`button-reply-${message.id}`}><MessageCircle size={13} /></button>
      </div>
    </div>
  </div>;
}

function MessageSkeletons() {
  return <div className="mx-auto max-w-3xl space-y-5 pt-10"><div className="mx-auto h-3 w-16 animate-soft-pulse rounded bg-[#ebe5da]" /><div className="flex gap-3"><div className="h-8 w-8 animate-soft-pulse rounded-xl bg-[#ebe5da]" /><div className="h-16 w-52 animate-soft-pulse rounded-2xl bg-[#f0ece4]" /></div><div className="flex justify-end"><div className="h-14 w-64 animate-soft-pulse rounded-2xl bg-[#dfeee7]" /></div><div className="flex gap-3"><div className="h-8 w-8 animate-soft-pulse rounded-xl bg-[#ebe5da]" /><div className="h-20 w-72 animate-soft-pulse rounded-2xl bg-[#f0ece4]" /></div></div>;
}

function ConversationDetails({ conversation, onClose }: { conversation: Conversation; onClose: () => void }) {
  return <aside className="absolute right-4 top-3 z-10 w-[min(300px,calc(100%-2rem))] rounded-2xl border border-[#dfdad0] bg-[#fbf9f4] p-5 shadow-[0_15px_40px_rgba(35,57,52,.12)]" data-testid="conversation-details"><div className="flex items-center justify-between"><p className="font-mono text-[10px] uppercase tracking-[.18em] text-[#78908a]">Conversation details</p><button onClick={onClose} aria-label="Close details" data-testid="button-close-details"><X size={16} /></button></div><div className="mt-5 flex items-center gap-3"><UserAvatar name={conversation.name} color={conversation.avatarColor} size="lg" /><div><p className="font-semibold text-[#253b40]">{conversation.name}</p><p className="mt-1 text-xs text-[#87938c]">{conversation.participants.length} participants</p></div></div><div className="mt-6 border-t border-[#e9e3d9] pt-4"><p className="text-xs font-semibold text-[#526862]">People in this conversation</p><div className="mt-3 space-y-3">{conversation.participants.map((person) => <div key={person.id} className="flex items-center gap-2.5"><UserAvatar name={person.name} initials={person.initials} color={person.avatarColor} size="sm" status={person.status} /><div className="min-w-0"><p className="truncate text-xs font-medium text-[#3a4c4f]">{person.name}</p><p className="text-[10px] text-[#91a099]">{statusText(person.status)}</p></div></div>)}</div></div></aside>;
}

function NewConversationDialog({ currentUserId, onClose, onCreated }: { currentUserId?: string; onClose: () => void; onCreated: (conversation: Conversation) => void }) {
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<string[]>([]);
  const params = search.trim() ? { search: search.trim() } : undefined;
  const users = useListUsers(params, { query: { enabled: true, queryKey: getListUsersQueryKey(params) } });
  const create = useCreateConversation();
  const recipients = (users.data ?? []).filter((person) => person.id !== currentUserId);
  const toggle = (id: string) => setSelected((current) => current.includes(id) ? [] : [id]);
  const submit = () => {
    if (!selected.length) return;
    create.mutate({ data: { participantIds: selected, kind: 'direct' } }, { onSuccess: onCreated });
  };
  return <div className="fixed inset-0 z-40 flex items-center justify-center bg-[#193640]/35 p-4 backdrop-blur-[2px]" role="dialog" aria-modal="true" aria-labelledby="new-conversation-title" data-testid="dialog-new-conversation">
    <div className="max-h-[min(680px,calc(100dvh-2rem))] w-full max-w-md overflow-hidden rounded-[24px] border border-[#e1dcd1] bg-[#fbf9f4] shadow-[0_24px_70px_rgba(25,54,64,.2)]">
      <div className="flex items-start justify-between border-b border-[#e9e3d9] px-6 py-5"><div><p className="font-mono text-[10px] uppercase tracking-[.2em] text-[#72918b]">New conversation</p><h2 id="new-conversation-title" className="mt-1 font-serif text-2xl text-[#193640]">Who is on your mind?</h2></div><button onClick={onClose} className="grid h-8 w-8 place-items-center rounded-lg text-[#788983] hover:bg-[#eeeae1]" aria-label="Close new conversation" data-testid="button-close-new-conversation"><X size={17} /></button></div>
      <div className="p-6"><label className="flex h-10 items-center gap-2 rounded-xl border border-[#e1ddd3] bg-[#f3f0e8] px-3 text-[#85938e] focus-within:border-[#76b9a9]"><Search size={16} /><input autoFocus value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Find a person" className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-[#a2aaa4]" aria-label="Find a person" data-testid="input-find-person" /></label><div className="mt-4 max-h-64 overflow-y-auto">{users.isLoading ? <div className="space-y-2">{[1, 2, 3].map((item) => <div key={item} className="h-14 animate-soft-pulse rounded-xl bg-[#eee9df]" />)}</div> : users.isError ? <p className="rounded-xl bg-[#fff0e8] p-3 text-sm text-[#986252]" data-testid="status-users-error">People are unavailable right now.</p> : recipients.length === 0 ? <p className="py-8 text-center text-sm text-[#8b9891]" data-testid="empty-users">No people found.</p> : <div className="space-y-1">{recipients.map((person) => <PersonOption key={person.id} person={person} selected={selected.includes(person.id)} onToggle={() => toggle(person.id)} />)}</div>}</div><button onClick={submit} disabled={!selected.length || create.isPending} className="mt-5 flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#247568] text-sm font-semibold text-[#f8f5ed] transition-transform hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-40" data-testid="button-create-conversation">{create.isPending ? 'Starting…' : 'Start conversation'}<ChevronDown className="rotate-[-90deg]" size={15} /></button>{create.isError && <p className="mt-3 text-center text-xs text-[#a65e4e]" data-testid="status-create-conversation-error">Could not start this conversation. Try again.</p>}</div>
    </div>
  </div>;
}

function PersonOption({ person, selected, onToggle }: { person: User; selected: boolean; onToggle: () => void }) {
  return <button onClick={onToggle} className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left ${selected ? 'bg-[#e2efe8]' : 'hover:bg-[#f0ece4]'}`} data-testid={`button-select-person-${person.id}`}><UserAvatar name={person.name} initials={person.initials} color={person.avatarColor} size="sm" status={person.status} /><span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium text-[#3c5050]">{person.name}</span><span className="block text-[11px] text-[#8a9991]">{person.role || statusText(person.status)}</span></span><span className={`grid h-5 w-5 place-items-center rounded-full border ${selected ? 'border-[#4b9888] bg-[#4b9888] text-white' : 'border-[#cbd6cf]'}`}>{selected && <Check size={13} />}</span></button>;
}