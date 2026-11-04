import { cookies } from "next/headers";
import { redirect } from "next/navigation";

export default async function Home() {
  const cookieStore = await cookies();
  const session = cookieStore.get("velzon_session");

  redirect(session ? "/apps-cms" : "/auth/login");
}
