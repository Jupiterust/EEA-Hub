"use client";

import { useState } from "react";
import { Settings, X } from "lucide-react";
import { SubmitButton } from "@/components/submit-button";
import { cn, inputClass } from "@/components/ui";

const tabs = [
  { key: "profile" as const, label: "编辑资料" },
  { key: "password" as const, label: "修改密码" },
];

interface Props {
  updateProfileAction: (formData: FormData) => Promise<void>;
  changePasswordAction: (formData: FormData) => Promise<void>;
  currentRealName: string;
  currentEmail: string;
  currentQq: string;
  currentBio: string;
  currentMajor: string;
  currentGrade: string;
}

export function ProfileSettingsModal({
  updateProfileAction,
  changePasswordAction,
  currentRealName,
  currentEmail,
  currentQq,
  currentBio,
  currentMajor,
  currentGrade,
}: Props) {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<"profile" | "password">("profile");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  function resetPasswordFields() {
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
  }

  function open_modal() {
    setTab("profile");
    resetPasswordFields();
    setOpen(true);
  }

  function close_modal() {
    resetPasswordFields();
    setOpen(false);
  }

  function switch_tab(key: "profile" | "password") {
    if (key !== tab) resetPasswordFields();
    setTab(key);
  }

  return (
    <>
      <button
        type="button"
        onClick={open_modal}
        className="rounded-md p-2 text-text-secondary hover:bg-elevated hover:text-text-primary"
        aria-label="账号设置"
      >
        <Settings className="h-5 w-5" />
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          onClick={(e) => { if (e.target === e.currentTarget) close_modal(); }}
        >
          <div className="flex max-h-[90vh] w-full max-w-md flex-col rounded-xl border border-border bg-surface shadow-2xl">
            <div className="flex items-center justify-between border-b border-border px-5 py-3">
              <div className="flex gap-1">
                {tabs.map(({ key, label }) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => switch_tab(key)}
                    className={cn(
                      "rounded-md px-3 py-1.5 text-sm font-semibold transition",
                      tab === key
                        ? "bg-primary/20 text-primary"
                        : "text-text-secondary hover:text-text-primary",
                    )}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <button
                type="button"
                onClick={close_modal}
                className="rounded-md p-1.5 text-text-secondary hover:bg-elevated hover:text-text-primary"
                aria-label="关闭"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="overflow-y-auto p-5">
              {tab === "profile" ? (
                <form action={updateProfileAction} className="grid gap-3">
                  <p className="text-sm text-text-secondary">以下信息将在个人主页公开显示，请谨慎填写。</p>
                  <input name="realName" defaultValue={currentRealName} placeholder="真实姓名" required className={inputClass} />
                  <input name="email" type="email" defaultValue={currentEmail} placeholder="邮箱（选填）" className={inputClass} />
                  <input name="qq" defaultValue={currentQq} placeholder="QQ 号（选填）" className={inputClass} />
                  <textarea name="bio" defaultValue={currentBio} placeholder="个性签名（选填，100 字以内）" maxLength={100} rows={3} className={inputClass} />
                  <input name="major" defaultValue={currentMajor} placeholder="专业（选填）" className={inputClass} />
                  <input name="grade" defaultValue={currentGrade} placeholder="年级（选填，如：大二 / 2024级）" className={inputClass} />
                  <SubmitButton pendingText="保存中...">保存资料</SubmitButton>
                </form>
              ) : (
                <form action={changePasswordAction} className="grid gap-3">
                  <input type="password" name="currentPassword" placeholder="当前密码" required autoComplete="current-password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} className={inputClass} />
                  <input type="password" name="newPassword" placeholder="新密码（至少 6 位）" required autoComplete="new-password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} className={inputClass} />
                  <input type="password" name="confirmPassword" placeholder="确认新密码" required autoComplete="new-password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} className={inputClass} />
                  <SubmitButton pendingText="修改中...">修改密码</SubmitButton>
                </form>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
