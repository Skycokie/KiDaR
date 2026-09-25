import { getMessages } from "@/i18n/get-messages";
import { getRequestLocale } from "@/i18n/get-request-locale";
import { LoginForm } from "./login-form";

export default function LoginPage() {
  const locale = getRequestLocale();
  return <LoginForm locale={locale} messages={getMessages(locale)} />;
}
