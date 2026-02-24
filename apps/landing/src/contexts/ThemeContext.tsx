import React, { createContext, useContext, useEffect } from "react";

// Light mode only - no theme switching
type Theme = "light";

interface ThemeContextType {
 theme: Theme;
 resolvedTheme: Theme;
 setTheme: (theme: Theme) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

interface ThemeProviderProps {
 children: React.ReactNode;
 defaultTheme?: Theme;
 storageKey?: string;
}

export function ThemeProvider({
 children,
 defaultTheme = "light",
 storageKey = "kahade-theme",
}: ThemeProviderProps) {
 // Always light mode
 const theme: Theme = "light";
 const resolvedTheme: Theme = "light";

 useEffect(() => {
 // Ensure light mode is always applied
 const root = document.documentElement;
 root.classList.remove("dark");
 root.classList.add("light");
 }, []);

 // setTheme is a no-op since we only support light mode
 const setTheme = (_theme: Theme) => {
 // No-op - light mode only
 };

 return (
 <ThemeContext.Provider value={{ theme, resolvedTheme, setTheme }}>
 {children}
 </ThemeContext.Provider>
 );
}

export function useTheme() {
 const context = useContext(ThemeContext);
 if (!context) {
 throw new Error("useTheme must be used within ThemeProvider");
 }
 return context;
}