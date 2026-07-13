export default function MessagesCard({ messages }) {
  if (!messages || !messages.trim()) return null;
  return <div className="messages-card">{messages}</div>;
}
