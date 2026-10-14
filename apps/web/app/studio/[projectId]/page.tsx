import { redirect } from "next/navigation";
import { getRequestLocale } from "@/i18n/get-request-locale";
import { personalizeHref } from "@/lib/studio-worlds";

type Props = { params: { projectId: string } };

/** Old Studio editor URL — worlds open in the personalize workspace now. */
export default function StudioProjectRedirectPage({ params }: Props) {
  redirect(personalizeHref(params.projectId, getRequestLocale()));
}
