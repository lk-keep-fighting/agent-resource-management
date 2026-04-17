import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { LoginForm } from "./login-form";
import { Brain } from "lucide-react";
import Link from "next/link";

interface LoginPageProps {
  searchParams: Promise<{ error?: string }>;
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = await searchParams;
  const errorMessage = params.error ? getErrorMessage(params.error) : null;

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100">
      <div className="absolute top-6 left-6">
        <Link href="/" className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-blue-600 to-purple-600 flex items-center justify-center">
            <Brain className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">ARM</h1>
            <p className="text-xs text-gray-500">Agent Resource Management</p>
          </div>
        </Link>
      </div>

      <Card className="w-[420px] shadow-xl border-0 bg-white/80 backdrop-blur">
        <CardHeader className="text-center pb-2">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-600 to-purple-600 flex items-center justify-center mx-auto mb-4">
            <Brain className="h-8 w-8 text-white" />
          </div>
          <CardTitle className="text-2xl font-bold">欢迎回来</CardTitle>
          <CardDescription>登录 ARM 系统，管理你的数字员工团队</CardDescription>
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

      <div className="absolute bottom-6 text-center text-gray-500 text-sm">
        <p>借鉴人力资源管理思想的 Agent 资源管理系统</p>
      </div>
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
