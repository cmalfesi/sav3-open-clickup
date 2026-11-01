import { existsSync, copyFileSync } from "node:fs";
for (const name of ["restore-plan", "restored-documents"]) {
  const target = `lib/${name}.json`;
  if (!existsSync(target)) copyFileSync(`lib/${name}.example.json`, target);
}
