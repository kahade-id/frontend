import { useEffect, useMemo } from "react";
import { useLocation } from "wouter";
import { Button } from "@kahade/ui";

const parseParams = (search: string) => {
 const params = new URLSearchParams(search);
 return {
 error: params.get("error"),
 errorDescription: params.get("error_description"),
 code: params.get("code"),
 };
};

export default function OAuthCallback() {
 const [, setLocation] = useLocation();
 const { error, errorDescription, code } = useMemo(
 () => parseParams(window.location.search),
 [],
 );

 useEffect(() => {
 const timeout = setTimeout(() => {
 setLocation("/login");
 }, 3000);

 return () => clearTimeout(timeout);
 }, [setLocation]);

 return (
 <div className="min-h-screen bg-white flex items-center justify-center px-6">
 <div className="max-w-md w-full text-center space-y-4">
 <h1 className="text-2xl font-semibold text-black">OAuth Callback</h1>
 {error ? (
 <p className="text-sm text-red-500">
 {errorDescription || `OAuth error: ${error}`}
 </p>
 ) : (
 <p className="text-sm text-muted-foreground">
 {code
 ? "OAuth response received. Redirecting to login..."
 : "OAuth callback received. Redirecting to login..."}
 </p>
 )}
 <Button className="w-full" onClick={() => setLocation("/login")}>
 Go to Login
 </Button>
 </div>
 </div>
 );
}
