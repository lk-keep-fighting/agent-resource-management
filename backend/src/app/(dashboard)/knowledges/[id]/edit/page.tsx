"use client";

import { useParams } from "next/navigation";
import { KnowledgeEditor } from "@/components/knowledge/knowledge-editor";

export default function EditKnowledgePage() {
  const params = useParams();
  const id = params.id as string;
  return <KnowledgeEditor mode="edit" knowledgeId={id} />;
}
