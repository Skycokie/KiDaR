import { redirect } from "next/navigation";
import { getRequestLocale } from "@/i18n/get-request-locale";
import { personalizeHref } from "@/lib/studio-worlds";

type Props = { params: { projectId: string } };

/** Legacy multi-step Simple Creator — worlds open in the personalize workspace now. */
export default function CreazaProjectRedirectPage({ params }: Props) {
  redirect(personalizeHref(params.projectId, getRequestLocale()));
}
