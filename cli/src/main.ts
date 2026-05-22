import { login, logout, getCurrentUser, register } from './cmd/auth';
import { listSkills, searchSkills, infoSkill, downloadSkill, uploadSkill, mySkills, deleteSkill, validateSkill } from './cmd/skill';
import { listAgents, searchAgents, infoAgent, downloadAgent, createAgent, updateAgent, deleteAgent, bindSkill, unbindSkill, bindKnowledge, unbindKnowledge, createAgentFromFolder } from './cmd/agent';
import { listKnowledge, searchKnowledge, infoKnowledge, downloadKnowledge, uploadKnowledge, myKnowledge, deleteKnowledge } from './cmd/knowledge';
import { showServer, setServer } from './cmd/server';
import { getOutputMode, setOutputMode } from './lib/output';

const args = process.argv.slice(2);
const command = args[0];
const subCommand = args[1];

async function main() {
  switch (command) {
    case 'register':
      if (args[1] && args[1].startsWith('--')) {
        const options: Record<string, string | undefined> = {};
        for (let i = 1; i < args.length; i++) {
          const arg = args[i];
          if (arg.startsWith('--')) {
            const [key, value] = arg.slice(2).split('=');
            options[key] = value;
          }
        }
        await register(options.name, options.email, options.password);
      } else {
        await register(args[1], args[2], args[3]);
      }
      break;

    case 'login':
      if (!args[1] || !args[2]) {
        console.error('用法: arm login <server-url> <api-key>');
        process.exit(1);
      }
      await login(args[1], args[2]);
      break;

    case 'logout':
      await logout();
      break;

    case 'server':
      if (subCommand === 'set' && args[2]) {
        setServer(args[2]);
      } else {
        showServer();
      }
      break;

    case 'skill':
      switch (subCommand) {
        case 'ls':
          await listSkills();
          break;
        case 'search':
          if (!args[2]) {
            console.error('用法: arm skill search <keyword>');
            process.exit(1);
          }
          await searchSkills(args[2]);
          break;
        case 'info':
          if (!args[2]) {
            console.error('用法: arm skill info <name>');
            process.exit(1);
          }
          await infoSkill(args[2]);
          break;
        case 'download':
          if (!args[2]) {
            console.error('用法: arm skill download <name> [output-dir]');
            process.exit(1);
          }
          await downloadSkill(args[2], args[3]);
          break;
        case 'upload':
          if (!args[2]) {
            console.error('用法: arm skill upload <path>');
            process.exit(1);
          }
          await uploadSkill(args[2]);
          break;
        case 'my':
          await mySkills();
          break;
        case 'delete':
          if (!args[2]) {
            console.error('用法: arm skill delete <name>');
            process.exit(1);
          }
          await deleteSkill(args[2]);
          break;
        case 'validate':
          if (!args[2]) {
            console.error('用法: arm skill validate <path>');
            process.exit(1);
          }
          await validateSkill(args[2]);
          break;
        default:
          console.log(`
可用命令:
  arm login <server-url> <api-key>   登录
  arm logout                          登出
  arm skill ls                        列出所有 Skill
  arm skill search <keyword>          搜索 Skill
  arm skill info <name>               查看 Skill 详情
  arm skill download <name> [dir]     下载 Skill
  arm skill upload <path>             上传 Skill
  arm skill my                        我的发布
  arm skill delete <name>             删除 Skill
  arm skill validate <path>           验证 Skill 格式
  arm server                          显示当前服务端
  arm server set <url>                设置服务端
`);
      }
      break;

    case 'knowledge':
      switch (subCommand) {
        case 'ls':
          await listKnowledge();
          break;
        case 'search':
          if (!args[2]) {
            console.error('用法: arm knowledge search <keyword>');
            process.exit(1);
          }
          await searchKnowledge(args[2]);
          break;
        case 'info':
          if (!args[2]) {
            console.error('用法: arm knowledge info <name>');
            process.exit(1);
          }
          await infoKnowledge(args[2]);
          break;
        case 'download':
          if (!args[2]) {
            console.error('用法: arm knowledge download <name> [output-dir]');
            process.exit(1);
          }
          await downloadKnowledge(args[2], args[3]);
          break;
        case 'upload':
          if (!args[2]) {
            console.error('用法: arm knowledge upload <path>');
            process.exit(1);
          }
          await uploadKnowledge(args[2]);
          break;
        case 'my':
          await myKnowledge();
          break;
        case 'delete':
          if (!args[2]) {
            console.error('用法: arm knowledge delete <name>');
            process.exit(1);
          }
          await deleteKnowledge(args[2]);
          break;
        default:
          console.log(`
可用命令:
  arm knowledge ls                    列出所有 Knowledge
  arm knowledge search <keyword>      搜索 Knowledge
  arm knowledge info <name>            查看 Knowledge 详情
  arm knowledge download <name> [dir]  下载 Knowledge
  arm knowledge upload <path>          上传 Knowledge
  arm knowledge my                     我的发布
  arm knowledge delete <name>          删除 Knowledge
`);
      }
      break;

    case 'me':
      await getCurrentUser();
      break;

    case 'output':
      if (subCommand === 'json' || subCommand === 'text') {
        setOutputMode(subCommand);
        console.log(`输出模式已设置为: ${subCommand}`);
      } else {
        const mode = getOutputMode();
        console.log(`当前输出模式: ${mode}`);
      }
      break;

    case 'agent':
      switch (subCommand) {
        case 'ls':
          await listAgents();
          break;
        case 'search':
          if (!args[2]) {
            console.error('用法: arm agent search <keyword>');
            process.exit(1);
          }
          await searchAgents(args[2]);
          break;
        case 'info':
          if (!args[2]) {
            console.error('用法: arm agent info <name>');
            process.exit(1);
          }
          await infoAgent(args[2]);
          break;
        case 'download':
          if (!args[2]) {
            console.error('用法: arm agent download <name> [output-dir]');
            process.exit(1);
          }
          await downloadAgent(args[2], args[3]);
          break;
        case 'create':
          if (!args[2]) {
            console.error('用法: arm agent create <name> [--description="..."] [--prompt="..."] [--avatar="..."] [--skill=id] [--knowledge=id] [--skill-config=\'{...}\'] [--knowledge-config=\'{...}\'] [--from=<folder-path>] [--json]');
            process.exit(1);
          }
          {
            const name = args[2];
            const options: Record<string, string | undefined> = {};
            const skills: string[] = [];
            const knowledges: string[] = [];
            const skillConfigs: string[] = [];
            const knowledgeConfigs: string[] = [];
            let fromFolder: string | undefined;

            for (let i = 3; i < args.length; i++) {
              const arg = args[i];
              if (arg.startsWith('--description=')) {
                options.description = arg.split('=').slice(1).join('=');
              } else if (arg.startsWith('--prompt=')) {
                options.prompt = arg.split('=').slice(1).join('=');
              } else if (arg.startsWith('--avatar=')) {
                options.avatar = arg.split('=').slice(1).join('=');
              } else if (arg.startsWith('--skill=')) {
                skills.push(arg.split('=').slice(1).join('='));
              } else if (arg.startsWith('--knowledge=')) {
                knowledges.push(arg.split('=').slice(1).join('='));
              } else if (arg.startsWith('--skill-config=')) {
                skillConfigs.push(arg.split('=').slice(1).join('='));
              } else if (arg.startsWith('--knowledge-config=')) {
                knowledgeConfigs.push(arg.split('=').slice(1).join('='));
              } else if (arg.startsWith('--from=')) {
                fromFolder = arg.split('=').slice(1).join('=');
              }
            }

            if (fromFolder) {
              await createAgentFromFolder(fromFolder);
            } else {
              await createAgent(name, {
                description: options.description,
                prompt: options.prompt,
                avatar: options.avatar,
                skills,
                knowledges,
                skillConfigs,
                knowledgeConfigs,
              });
            }
          }
          break;
        case 'update':
          if (!args[2]) {
            console.error('用法: arm agent update <id> [--name="..."] [--description="..."] [--prompt="..."] [--avatar="..."] [--status=active|draft] [--json]');
            process.exit(1);
          }
          {
            const id = args[2];
            const options: Record<string, string | undefined> = {};

            for (let i = 3; i < args.length; i++) {
              const arg = args[i];
              if (arg.startsWith('--name=')) {
                options.name = arg.split('=').slice(1).join('=');
              } else if (arg.startsWith('--description=')) {
                options.description = arg.split('=').slice(1).join('=');
              } else if (arg.startsWith('--prompt=')) {
                options.prompt = arg.split('=').slice(1).join('=');
              } else if (arg.startsWith('--avatar=')) {
                options.avatar = arg.split('=').slice(1).join('=');
              } else if (arg.startsWith('--status=')) {
                options.status = arg.split('=').slice(1).join('=');
              }
            }

            await updateAgent(id, {
              name: options.name,
              description: options.description,
              prompt: options.prompt,
              avatar: options.avatar,
              status: options.status as 'active' | 'draft' | undefined,
            });
          }
          break;
        case 'delete':
          if (!args[2]) {
            console.error('用法: arm agent delete <id> [--json]');
            process.exit(1);
          }
          await deleteAgent(args[2]);
          break;
        case 'bind':
          if (!args[2]) {
            console.error('用法: arm agent bind <id> --skill=<skillId> [--skill-config=\'{...}\'] 或 arm agent bind <id> --knowledge=<knowledgeId> [--knowledge-config=\'{...}\'] [--json]');
            process.exit(1);
          }
          {
            const id = args[2];
            let skillId: string | undefined;
            let knowledgeId: string | undefined;
            let skillConfig: string | undefined;
            let knowledgeConfig: string | undefined;

            for (let i = 3; i < args.length; i++) {
              const arg = args[i];
              if (arg.startsWith('--skill=')) {
                skillId = arg.split('=').slice(1).join('=');
              } else if (arg.startsWith('--knowledge=')) {
                knowledgeId = arg.split('=').slice(1).join('=');
              } else if (arg.startsWith('--skill-config=')) {
                skillConfig = arg.split('=').slice(1).join('=');
              } else if (arg.startsWith('--knowledge-config=')) {
                knowledgeConfig = arg.split('=').slice(1).join('=');
              }
            }

            if (skillId) {
              await bindSkill(id, skillId, skillConfig);
            } else if (knowledgeId) {
              await bindKnowledge(id, knowledgeId, knowledgeConfig);
            } else {
              console.error('用法: arm agent bind <id> --skill=<skillId> 或 --knowledge=<knowledgeId>');
              process.exit(1);
            }
          }
          break;
        case 'unbind':
          if (!args[2]) {
            console.error('用法: arm agent unbind <id> --skill=<skillId> 或 --knowledge=<knowledgeId> [--json]');
            process.exit(1);
          }
          {
            const id = args[2];
            let skillId: string | undefined;
            let knowledgeId: string | undefined;

            for (let i = 3; i < args.length; i++) {
              const arg = args[i];
              if (arg.startsWith('--skill=')) {
                skillId = arg.split('=').slice(1).join('=');
              } else if (arg.startsWith('--knowledge=')) {
                knowledgeId = arg.split('=').slice(1).join('=');
              }
            }

            if (skillId) {
              await unbindSkill(id, skillId);
            } else if (knowledgeId) {
              await unbindKnowledge(id, knowledgeId);
            } else {
              console.error('用法: arm agent unbind <id> --skill=<skillId> 或 --knowledge=<knowledgeId>');
              process.exit(1);
            }
          }
          break;
        default:
          console.log(`
可用命令:
  arm agent ls                        列出所有 Agent
  arm agent search <keyword>          搜索 Agent
  arm agent info <name>               查看 Agent 详情
  arm agent download <name> [dir]     下载 Agent
  arm agent create <name>             创建 Agent (--description, --prompt, --avatar, --skill, --knowledge)
  arm agent create --from=<folder>    从本地文件夹创建 Agent
  arm agent update <id>               更新 Agent (--name, --description, --prompt, --avatar, --status)
  arm agent delete <id>                删除 Agent
  arm agent bind <id> --skill=<id>    绑定 Skill 到 Agent
  arm agent unbind <id> --skill=<id>  解绑 Skill
  arm agent bind <id> --knowledge=<id> 绑定 Knowledge 到 Agent
  arm agent unbind <id> --knowledge=<id> 解绑 Knowledge
  所有命令支持 --json 参数获取机器可读输出
`);
      }
      break;

    default:
      console.log(`
Agent Resource Management (arm)

用法:
  arm register [--name=<name>] [--email=<email>] [--password=<password>]  注册 (交互式或参数)
  arm login <server-url> <api-key>   登录
  arm logout                          登出
  arm output [json|text]              设置/查看输出模式 (默认json)
  arm skill ls                        列出所有 Skill
  arm skill search <keyword>          搜索 Skill
  arm skill info <name>               查看 Skill 详情
  arm skill download <name> [dir]    下载 Skill
  arm skill upload <path>             上传 Skill
  arm skill my                        我的发布
  arm skill delete <name>             删除 Skill
  arm skill validate <path>           验证 Skill 格式
  arm knowledge ls                    列出所有 Knowledge
  arm knowledge search <keyword>      搜索 Knowledge
  arm knowledge info <name>           查看 Knowledge 详情
  arm knowledge download <name> [dir] 下载 Knowledge
  arm knowledge upload <path>         上传 Knowledge
  arm knowledge my                    我的发布
  arm knowledge delete <name>        删除 Knowledge
  arm agent ls                        列出所有 Agent
  arm agent search <keyword>          搜索 Agent
  arm agent info <name>               查看 Agent 详情
  arm agent download <name> [dir]     下载 Agent
  arm agent create <name>             创建 Agent
  arm agent update <id>               更新 Agent
  arm agent delete <id>                删除 Agent
  arm agent bind <id> --skill=<id>    绑定 Skill
  arm agent unbind <id> --skill=<id>  解绑 Skill
  arm agent bind <id> --knowledge=<id> 绑定 Knowledge
  arm agent unbind <id> --knowledge=<id> 解绑 Knowledge
  arm server                          显示当前服务端
  arm server set <url>                设置服务端
  使用 arm <entity> -h 查看详细帮助
`);
  }
}

main().catch((err) => {
  console.error('Error:', err);
  process.exit(1);
});