import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { LoginForm } from "./login-form";

interface LoginPageProps {
  searchParams: Promise<{ error?: string }>;
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = await searchParams;
  const errorMessage = params.error ? getErrorMessage(params.error) : null;

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <Card className="w-[400px]">
        <CardHeader>
          <CardTitle>Agent Skill System</CardTitle>
          <CardDescription>选择登录方式</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {errorMessage && (
            <div className="p-3 text-sm text-red-500 bg-red-50 border border-red-200 rounded">
              {errorMessage}
            </div>
          )}
          <LoginForm />
        </CardContent>
      </Card>
    </div>
  );
}

function getErrorMessage(error: string): string {
  const errorMap: Record<string, string> = {
    no_token: '无法获取登录凭证，请重试',
    server_config_error: '服务器配置错误，请联系管理员',
    invalid_token: '登录凭证无效，请重新登录',
  };
  return errorMap[error] || `登录失败: ${error}`;
}
