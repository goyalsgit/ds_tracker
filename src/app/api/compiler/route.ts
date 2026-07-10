import { NextRequest, NextResponse } from "next/server";

// Using Wandbox API - free, no API key required
// Supports: C++, C, Python, Java, JavaScript, Rust, Go, and more
const WANDBOX_API = "https://wandbox.org/api/compile.json";

// Language mappings for Wandbox API
const LANGUAGE_MAP: Record<string, { compiler: string; ext: string }> = {
  cpp: { compiler: "gcc-head", ext: "cpp" },
  "c++": { compiler: "gcc-head", ext: "cpp" },
  c: { compiler: "gcc-head-c", ext: "c" },
  python: { compiler: "cpython-3.12.0", ext: "py" },
  python3: { compiler: "cpython-3.12.0", ext: "py" },
  java: { compiler: "openjdk-head", ext: "java" },
  javascript: { compiler: "nodejs-20.10.0", ext: "js" },
  js: { compiler: "nodejs-20.10.0", ext: "js" },
  rust: { compiler: "rust-head", ext: "rs" },
  go: { compiler: "go-head", ext: "go" },
};

export async function POST(req: NextRequest) {
  try {
    const { code, language = "cpp", stdin = "" } = await req.json();

    if (!code || typeof code !== "string") {
      return NextResponse.json({ error: "Code is required" }, { status: 400 });
    }

    if (code.length > 100000) {
      return NextResponse.json({ error: "Code too long (max 100KB)" }, { status: 400 });
    }

    const langConfig = LANGUAGE_MAP[language.toLowerCase()] || LANGUAGE_MAP.cpp;

    // For Java, we need to wrap the code if it doesn't have a class
    let processedCode = code;
    if (language === "java" && !code.includes("class ")) {
      processedCode = `public class Main {\n${code}\n}`;
    }

    // Call Wandbox API
    const response = await fetch(WANDBOX_API, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        code: processedCode,
        compiler: langConfig.compiler,
        stdin: stdin,
        options: language === "cpp" || language === "c++" ? "c++17,boost-1.84.0-gcc-head" : "",
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("[Compiler] Wandbox API error:", errorText);
      return NextResponse.json(
        { error: "Compilation service temporarily unavailable. Try again." },
        { status: 503 }
      );
    }

    const result = await response.json();

    // Format the response
    const hasCompileError = result.compiler_error || (result.status !== "0" && !result.program_output);
    const hasRuntimeError = result.program_error && result.status !== "0";

    const output = {
      success: !hasCompileError && !hasRuntimeError,
      language: language,
      compiler: langConfig.compiler,
      stdout: result.program_output || "",
      stderr: result.program_error || "",
      compileOutput: result.compiler_output || "",
      compileError: result.compiler_error || "",
      status: result.status,
      signal: result.signal,
    };

    // Check for compilation errors
    if (hasCompileError) {
      return NextResponse.json({
        ...output,
        success: false,
        error: "Compilation error",
        errorMessage: result.compiler_error || result.compiler_message || "Compilation failed",
      });
    }

    // Check for runtime errors
    if (hasRuntimeError) {
      return NextResponse.json({
        ...output,
        success: false,
        error: result.signal ? `Runtime error (${result.signal})` : "Runtime error",
        errorMessage: result.program_error,
      });
    }

    return NextResponse.json(output);
  } catch (error) {
    console.error("[Compiler] Error:", error);
    return NextResponse.json(
      { error: "Failed to compile code. Please try again.", success: false },
      { status: 500 }
    );
  }
}
