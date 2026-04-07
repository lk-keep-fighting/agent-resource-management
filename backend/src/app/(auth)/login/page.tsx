import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { LoginForm } from "./login-form";

export default async function LoginPage() {
  const ssoUrl = process.env.SSO_URL || '';

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <Card className="w-[400px]">
        <CardHeader>
          <CardTitle>Agent Skill System</CardTitle>
          <CardDescription>选择登录方式</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <LoginForm ssoUrl={ssoUrl} />
        </CardContent>
      </Card>
    </div>
  );
}
