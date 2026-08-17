
import { zodResolver } from "@hookform/resolvers/zod";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { useNavigate, useParams } from "react-router-dom";

import { loginSchema, type LoginInput } from "@/lib/auth-schema";
import { useT } from "@/lib/i18n/useT";

export function LoginForm() {
  const t = useT();
  const navigate = useNavigate();
  const { lang } = useParams();
  const queryClient = useQueryClient();
  const [serverError, setServerError] = useState("");
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginInput>({ resolver: zodResolver(loginSchema) });

  async function onSubmit(values: LoginInput) {
    setServerError("");
    const res = await fetch("/api/v1/authentication/login", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(values),
    });
    if (!res.ok) {
      setServerError(t.login.invalidCredentials);
      return;
    }
    // Clear the cached session probe so StaffGuard re-fetches fresh (no stale
    // 401 flash) after the cookie is set.
    queryClient.removeQueries({ queryKey: ["session"] });
    navigate(`/${lang ?? "th"}/staff`);
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="mx-auto max-w-sm space-y-4" noValidate>
      <div className="space-y-1">
        <label htmlFor="username" className="text-sm font-medium">
          {t.login.username}
        </label>
        <input
          id="username"
          className="w-full rounded border border-stone-300 p-2"
          {...register("username")}
        />
        {errors.username ? <p className="text-sm text-red-600">{errors.username.message}</p> : null}
      </div>
      <div className="space-y-1">
        <label htmlFor="password" className="text-sm font-medium">
          {t.login.password}
        </label>
        <input
          id="password"
          type="password"
          className="w-full rounded border border-stone-300 p-2"
          {...register("password")}
        />
        {errors.password ? <p className="text-sm text-red-600">{errors.password.message}</p> : null}
      </div>
      {serverError ? <p className="text-sm text-red-600">{serverError}</p> : null}
      <button
        type="submit"
        disabled={isSubmitting}
        className="w-full rounded bg-stone-800 p-2 text-white disabled:opacity-50"
      >
        {t.login.submit}
      </button>
    </form>
  );
}
