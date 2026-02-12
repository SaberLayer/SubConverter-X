export interface RuleTemplate {
  id: string;
  name: string;
  description: string;
  generate(proxyGroupName: string): string[] | Promise<string[]>;
}

const templates: Map<string, RuleTemplate> = new Map();

export function registerRule(tpl: RuleTemplate) {
  templates.set(tpl.id, tpl);
}

export function getRule(id: string): RuleTemplate | undefined {
  return templates.get(id);
}

export function getAllRules(): { id: string; name: string; description: string }[] {
  return Array.from(templates.values()).map((t) => ({
    id: t.id,
    name: t.name,
    description: t.description,
  }));
}

// Register built-in rules (use require to avoid ESM import hoisting)
require('./bypass-cn');
require('./global');
require('./acl4ssr');
