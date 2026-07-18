import { createFileRoute } from "@tanstack/react-router";
import { Shell } from "@/components/Shell";
import { ChatView } from "@/components/ChatView";

export const Route = createFileRoute("/c/$threadId")({
  component: ThreadPage,
});

function ThreadPage() {
  const { threadId } = Route.useParams();
  return (
    <Shell>
      <ChatView threadId={threadId} />
    </Shell>
  );
}