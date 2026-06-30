import { describe, it, expect } from "bun:test";
import { buildSystemPrompt } from "./context-builder.ts";

const baseAgent = (kbs: any[]) => ({
  id: "a", name: "A", description: "d", prompt: "你是助手", version: "1", status: "active",
  createdAt: "", updatedAt: "", createdBy: "",
  knowledgeBindings: kbs,
}) as any;

describe("buildSystemPrompt 知识分区", () => {
  it("enableTools 时 essential 走文件提示、experience 走检索提示", () => {
    const p = buildSystemPrompt(baseAgent([
      { knowledgeId: "k1", knowledgeName: "必备A", version: "1", kind: "essential" },
      { knowledgeId: "k2", knowledgeName: "经验B", version: "1", kind: "experience" },
    ]), null, {
      enableTools: true, cwd: "/ws",
      essentialFiles: [{ name: "必备A", filename: "A.md" }],
    });
    expect(p).toContain("必备业务知识");
    expect(p).toContain("knowledges/A.md");
    expect(p).toContain("工作经验");
    expect(p).toContain("经验B");
    expect(p).toContain("knowledge_search");
  });

  it("enableTools=false 时 essential 内联、不出现 knowledges/ 路径", () => {
    const p = buildSystemPrompt(baseAgent([
      { knowledgeId: "k1", knowledgeName: "必备A", version: "1", kind: "essential" },
    ]), null, {
      enableTools: false, cwd: "/ws",
      essentialInline: [{ name: "必备A", content: "内联正文" }],
    });
    expect(p).toContain("必备业务知识");
    expect(p).toContain("内联正文");
    expect(p).not.toContain("knowledges/");
  });

  it("加载失败时提示 essentialErrors", () => {
    const p = buildSystemPrompt(baseAgent([
      { knowledgeId: "k1", knowledgeName: "必备A", version: "1", kind: "essential" },
    ]), null, { enableTools: true, cwd: "/ws", essentialErrors: ["必备A"] });
    expect(p).toContain("加载失败");
  });

  it("无 kind 的老绑定按 experience 处理", () => {
    const p = buildSystemPrompt(baseAgent([
      { knowledgeId: "k9", knowledgeName: "老知识", version: "1" },
    ]), null, { enableTools: true, cwd: "/ws" });
    expect(p).toContain("工作经验");
    expect(p).toContain("老知识");
  });
});

describe("buildSystemPrompt 引用经验", () => {
  it("pinnedExperience 注入「用户本次引用的工作经验」分区与内容", () => {
    const p = buildSystemPrompt(baseAgent([]), null, {
      pinnedExperience: [{ name: "OOM 排查三步", content: "第一步：看 GC 日志" }],
    });
    expect(p).toContain("用户本次引用的工作经验");
    expect(p).toContain("OOM 排查三步");
    expect(p).toContain("第一步：看 GC 日志");
  });

  it("无 pinnedExperience 时不出现引用分区", () => {
    const p = buildSystemPrompt(baseAgent([]), null, {});
    expect(p).not.toContain("用户本次引用的工作经验");
  });

  it("pinnedErrors 输出加载失败提示", () => {
    const p = buildSystemPrompt(baseAgent([]), null, {
      pinnedExperience: [{ name: "A", content: "a" }],
      pinnedErrors: ["kMissing"],
    });
    expect(p).toContain("部分引用经验加载失败");
    expect(p).toContain("kMissing");
  });
});
