import { login, logout, getCurrentUser } from './cmd/auth';
import { listSkills, searchSkills, infoSkill, downloadSkill, uploadSkill, mySkills, deleteSkill, validateSkill } from './cmd/skill';
import { listAgents, searchAgents, infoAgent, downloadAgent } from './cmd/agent';
import { listKnowledge, searchKnowledge, infoKnowledge, downloadKnowledge, uploadKnowledge, myKnowledge, deleteKnowledge } from './cmd/knowledge';
import { showServer, setServer } from './cmd/server';

const args = process.argv.slice(2);
const command = args[0];
const subCommand = args[1];

async function main() {
  switch (command) {
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
        default:
          console.log(`
可用命令:
  arm agent ls                        列出所有 Agent
  arm agent search <keyword>          搜索 Agent
  arm agent info <name>               查看 Agent 详情
  arm agent download <name> [dir]     下载 Agent
`);
      }
      break;

    default:
      console.log(`
Agent Resource Management (arm)

用法:
  arm login <server-url> <api-key>   登录
  arm logout                          登出
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
  arm server                          显示当前服务端
  arm server set <url>                设置服务端
`);
  }
}

main().catch((err) => {
  console.error('Error:', err);
  process.exit(1);
});