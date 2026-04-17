import { redirect } from "next/navigation";

// Root redirects to the dashboard; if the user isn't logged in, middleware
// kicks them over to /login.
export default function Home() {
  redirect("/dashboard");
}
