import type { Division, Team, UserRole, UserStatus } from "@prisma/client";

export const divisionLabels: Record<Division, string> = {
  SOFTWARE: "软件部",
  ANALOG: "模电部",
  GENERAL: "通用",
};

export const teamLabels: Record<Team, string> = {
  CONTROL: "控制组",
  VISION: "视觉组",
  FPGA: "FPGA组",
  HARDWARE: "硬件组",
  GENERAL: "通用",
};

export const roleLabels: Record<UserRole, string> = {
  MEMBER: "普通成员",
  LEADER: "部门负责人",
  ADMIN: "管理员",
};

export const statusLabels: Record<UserStatus, string> = {
  PENDING: "待审核",
  ACTIVE: "已激活",
  BANNED: "已禁用",
};

export const validTeamsByDivision = {
  SOFTWARE: ["CONTROL", "VISION"],
  ANALOG: ["FPGA", "HARDWARE"],
  GENERAL: ["GENERAL"],
} as const;
