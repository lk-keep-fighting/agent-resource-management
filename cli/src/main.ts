import { login, logout, getCurrentUser } from './cmd/auth';
import { listSkills, searchSkills, infoSkill, downloadSkill, uploadSkill, mySkills, deleteSkill, validateSkill } from './cmd/skill';
import { showServer, setServer } from './cmd/server';

const args = process.argv.slice(2);
const command = args[0];
const subCommand = args[1];

async function main() {
  switch (command) {
    case 'login':
      if (!args[1] || !args[2]) {
        console.error('用法: adk login <server-url> <api-key>');
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
            console.error('用法: adk skill search <keyword>');
            process.exit(1);
          }
          await searchSkills(args[2]);
          break;
        case 'info':
          if (!args[2]) {
            console.error('用法: adk skill info <name>');
            process.exit(1);
          }
          await infoSkill(args[2]);
          break;
        case 'download':
          if (!args[2]) {
            console.error('用法: adk skill download <name> [output-dir]');
            process.exit(1);
          }
          await downloadSkill(args[2], args[3]);
          break;
        case 'upload':
          if (!args[2]) {
            console.error('用法: adk skill upload <path>');
            process.exit(1);
          }
          await uploadSkill(args[2]);
          break;
        case 'my':
          await mySkills();
          break;
        case 'delete':
          if (!args[2]) {
            console.error('用法: adk skill delete <name>');
            process.exit(1);
          }
          await deleteSkill(args[2]);
          break;
        case 'validate':
          if (!args[2]) {
            console.error('用法: adk skill validate <path>');
            process.exit(1);
          }
          await validateSkill(args[2]);
          break;
        default:
          console.log(`
可用命令:
  adk login <server-url> <api-key>   登录
  adk logout                          登出
  adk skill ls                        列出所有 Skill
  adk skill search <keyword>          搜索 Skill
  adk skill info <name>               查看 Skill 详情
  adk skill download <name> [dir]    下载 Skill
  adk skill upload <path>            上传 Skill
  adk skill my                       我的发布
  adk skill delete <name>            删除 Skill
  adk skill validate <path>           验证 Skill 格式
  adk server                         显示当前服务端
  adk server set <url>               设置服务端
`);
      }
      break;

    case 'me':
      await getCurrentUser();
      break;

    default:
      console.log(`
Agent Skill CLI (adk)

用法:
  adk login <server-url> <api-key>   登录
  adk logout                          登出
  adk skill ls                        列出所有 Skill
  adk skill search <keyword>          搜索 Skill
  adk skill info <name>               查看 Skill 详情
  adk skill download <name> [dir]     下载 Skill
  adk skill upload <path>             上传 Skill
  adk skill my                        我的发布
  adk skill delete <name>             删除 Skill
  adk server                          显示当前服务端
  adk server set <url>                设置服务端
`);
  }
}

main().catch((err) => {
  console.error('Error:', err);
  process.exit(1);
});