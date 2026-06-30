import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { existsSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { sanitizeFilename, prepareEssentialKnowledges, __resetEssentialCacheForTests } from "./knowledge-env.ts";

const fakeArm = (contents: Record<string, string>) => ({
  getKnowledgeById: async (id: string) => ({ id, name: id, content: contents[id] }),
});

const tmp = join(process.cwd(), "data", "test-tmp-ess");

describe("sanitizeFilename", () => {
  it("保留字母数字中文与 _-", () => {
    expect(sanitizeFilename("Nginx 504 / 超时.md")).toBe("Nginx_504___超时_md");
    expect(sanitizeFilename("a-b_c.1")).toBe("a-b_c_1");
  });
});

describe("prepareEssentialKnowledges", () => {
  beforeEach(() => {
    __resetEssentialCacheForTests();
    rmSync(tmp, { recursive: true, force: true });
  });
  afterEach(() => {
    rmSync(tmp, { recursive: true, force: true });
  });

  it("enableTools 时写入 knowledges/*.md 文件", async () => {
    const r = await prepareEssentialKnowledges(
      [{ knowledgeId: "k1", knowledgeName: "必备A", version: "1.0.0" }],
      tmp, true, fakeArm({ k1: "# A\n正文" }) as any,
    );
    expect(r.files.length).toBe(1);
    expect(r.inline.length).toBe(0);
    const fp = join(tmp, "knowledges", "必备A.md");
    expect(existsSync(fp)).toBe(true);
    expect(readFileSync(fp, "utf-8")).toContain("正文");
  });

  it("enableTools=false 时走 inline，不写文件", async () => {
    const r = await prepareEssentialKnowledges(
      [{ knowledgeId: "k1", knowledgeName: "必备A", version: "1.0.0" }],
      tmp, false, fakeArm({ k1: "正文A" }) as any,
    );
    expect(r.inline.length).toBe(1);
    expect(r.inline[0].content).toBe("正文A");
    expect(r.files.length).toBe(0);
    expect(existsSync(join(tmp, "knowledges"))).toBe(false);
  });

  it("content 命中缓存时不再次拉取", async () => {
    let calls = 0;
    const arm = { getKnowledgeById: async (id: string) => { calls++; return { id, content: "c" }; } };
    await prepareEssentialKnowledges([{ knowledgeId: "k1", version: "1.0.0" }], tmp, false, arm as any);
    await prepareEssentialKnowledges([{ knowledgeId: "k1", version: "1.0.0" }], tmp, false, arm as any);
    expect(calls).toBe(1);
  });

  it("getKnowledgeById 返回 null 时记入 errors 不抛错", async () => {
    const arm = { getKnowledgeById: async () => null };
    const r = await prepareEssentialKnowledges(
      [{ knowledgeId: "kx", knowledgeName: "缺失", version: "1.0.0" }], tmp, true, arm as any,
    );
    expect(r.errors).toEqual(["缺失"]);
    expect(r.files.length).toBe(0);
  });
});

import { resolvePinnedExperience } from "./knowledge-env.ts";

describe("resolvePinnedExperience", () => {
  const fakeArm = (db: Record<string, any>) => ({
    getKnowledgeById: async (id: string) => db[id] ?? null,
  });

  it("取全文并保留 name，去重，缺失进 errors", async () => {
    const r = await resolvePinnedExperience(
      ["k1", "k1", "k2", "kMissing"],
      fakeArm({
        k1: { id: "k1", name: "经验一", content: "c1" },
        k2: { id: "k2", name: "经验二", content: "c2" },
      }) as any,
    );
    expect(r.items).toEqual([
      { name: "经验一", content: "c1" },
      { name: "经验二", content: "c2" },
    ]);
    expect(r.errors).toEqual(["kMissing"]);
  });

  it("content 缺失时当作空串，name 缺失回退为 id", async () => {
    const r = await resolvePinnedExperience(
      ["k1"],
      fakeArm({ k1: { id: "k1" } }) as any,
    );
    expect(r.items).toEqual([{ name: "k1", content: "" }]);
  });
});
