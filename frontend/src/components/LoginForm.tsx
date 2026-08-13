"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { useRouter } from "next/navigation";

import { loginSchema, type LoginInput } from "@/lib/auth-schema";

export function LoginForm() {
  const router = useRouter();
  const [serverError, setServerError] = useState("");
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginInput>({ resolver: zodResolver(loginSchema) });

  async function onSubmit(values: LoginInput) {
    setServerError("");
    const res = await fetch("/bff/session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(values),
    });
    if (!res.ok) {
      setServerError("Invalid credentials.");
      return;
    }
    router.push("/staff");
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="mx-auto max-w-sm space-y-4" noValidate>
      <div className="space-y-1">
        <label htmlFor="username" className="text-sm font-medium">
          Username
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
          Password
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
        Log in
      </button>
    </form>
  );
}
