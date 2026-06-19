"use client";

import { useMemo, useState } from "react";
import type { Division, Team } from "@prisma/client";
import { inputClass } from "@/components/ui";
import { divisionLabels, teamLabels } from "@/lib/labels";

const teamOptions: Record<Division, Team[]> = {
  GENERAL: ["GENERAL"],
  SOFTWARE: ["GENERAL", "CONTROL", "VISION"],
  ANALOG: ["GENERAL", "FPGA", "HARDWARE"],
};

export function DivisionTeamSelect({
  allowGeneralDivision = true,
  defaultDivision,
  defaultTeam = "GENERAL",
}: {
  allowGeneralDivision?: boolean;
  defaultDivision?: Division;
  defaultTeam?: Team;
}) {
  const initialDivision = defaultDivision ?? (allowGeneralDivision ? "GENERAL" : "SOFTWARE");
  const [division, setDivision] = useState<Division>(initialDivision);
  const teams = useMemo(() => teamOptions[division], [division]);
  const selectedTeam = teams.includes(defaultTeam) ? defaultTeam : teams[0];

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <label className="grid gap-1.5 text-sm font-semibold text-text-primary">
        <span>部门</span>
        <select
          name="division"
          value={division}
          onChange={(event) => setDivision(event.target.value as Division)}
          className={inputClass}
        >
          {allowGeneralDivision ? <option value="GENERAL">{divisionLabels.GENERAL}</option> : null}
          <option value="SOFTWARE">{divisionLabels.SOFTWARE}</option>
          <option value="ANALOG">{divisionLabels.ANALOG}</option>
        </select>
      </label>
      <label className="grid gap-1.5 text-sm font-semibold text-text-primary">
        <span>小组</span>
        <select key={division} name="team" defaultValue={selectedTeam} className={inputClass}>
          {teams.map((team) => (
            <option key={team} value={team}>
              {teamLabels[team]}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}
