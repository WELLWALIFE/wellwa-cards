import { CardEditor } from "@/components/editor/card-editor";

export default async function CardBuilderPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <CardEditor id={id} />;
}
