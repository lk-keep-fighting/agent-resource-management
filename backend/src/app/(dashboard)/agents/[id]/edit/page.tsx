"use client";

import { useParams } from "next/navigation";
import { AgentEditor } from "@/components/agent/agent-editor";

export default function EditAgentPage() {
  const params = useParams();
  const id = params.id as string;
  return <AgentEditor mode="edit" agentId={id} />;
}
