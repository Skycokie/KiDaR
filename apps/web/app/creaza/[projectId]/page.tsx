import { redirect } from "next/navigation";

type Props = { params: { projectId: string } };

/** Legacy multi-step Simple Creator — worlds open in Studio now. */
export default function CreazaProjectRedirectPage({ params }: Props) {
  redirect(`/studio/${params.projectId}`);
}
