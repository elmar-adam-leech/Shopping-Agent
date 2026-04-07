import { Link, useLocation } from "wouter";
import { MessageSquare, Settings, Store as StoreIcon, ShoppingBag, Menu, Shield, LayoutDashboard } from "lucide-react";
import { useCartStore } from "@/store/use-cart-store";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from "@/components/ui/sheet";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { useState } from "react";

interface AppLayoutProps {
  children: React.ReactNode;
  storeDomain?: string;
}

export function AppLayout({ children, storeDomain }: AppLayoutProps) {
  const [location] = useLocation();
  const cartStore = useCartStore();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const navigation = storeDomain ? [
    { name: 'Chat', href: `/${storeDomain}/chat`, icon: MessageSquare },
    { name: 'Knowledge & Settings', href: `/${storeDomain}/settings`, icon: Settings },
  ] : [];

  const bottomNavItems = storeDomain ? [
    { name: 'Home', href: '/', icon: LayoutDashboard },
    { name: 'Chat', href: `/${storeDomain}/chat`, icon: MessageSquare },
    { name: 'Settings', href: `/${storeDomain}/settings`, icon: Settings },
    { name: 'Cart', href: '#cart', icon: ShoppingBag, action: () => cartStore.setIsOpen(true) },
  ] : [];

  const NavLinks = () => (
    <>
      {storeDomain ? (
        <div className="flex flex-col h-full">
          <div className="px-4 py-6 border-b border-border/50">
            <Link href="/" className="flex items-center gap-3 group">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-primary to-primary/60 flex items-center justify-center text-primary-foreground shadow-lg shadow-primary/20 group-hover:scale-105 transition-transform duration-300">
                <StoreIcon className="w-5 h-5" />
              </div>
              <div>
                <h2 className="font-bold text-sm text-foreground leading-tight truncate max-w-[160px]">
                  {storeDomain}
                </h2>
                <p className="text-xs text-muted-foreground font-medium">Switch Store</p>
              </div>
              <span className="ml-auto flex items-center gap-1 px-2 py-0.5 rounded-full bg-violet-100 dark:bg-violet-500/20 text-violet-700 dark:text-violet-300 text-[10px] font-semibold">
                <Shield className="w-3 h-3" />
                UCP
              </span>
            </Link>
          </div>
          
          <nav className="flex-1 px-4 py-6 space-y-2">
            {navigation.map((item) => {
              const isActive = location.startsWith(item.href);
              return (
                <Link key={item.name} href={item.href}>
                  <div className={`
                    flex items-center gap-3 px-3 py-3 min-h-11 rounded-xl transition-all duration-200 cursor-pointer font-medium text-sm
                    ${isActive 
                      ? 'bg-primary/10 text-primary hover:bg-primary/15' 
                      : 'text-muted-foreground hover:bg-secondary/50 hover:text-foreground'}
                  `}>
                    <item.icon className={`w-5 h-5 ${isActive ? 'text-primary' : 'text-muted-foreground'}`} />
                    {item.name}
                  </div>
                </Link>
              );
            })}
          </nav>

          <div className="p-4 border-t border-border/50 space-y-3">
            <button 
              onClick={() => cartStore.setIsOpen(true)}
              className="w-full flex items-center justify-between px-4 py-3 min-h-11 rounded-xl bg-secondary/30 hover:bg-secondary/60 text-foreground transition-all duration-200"
            >
              <div className="flex items-center gap-2 font-medium text-sm">
                <ShoppingBag className="w-4 h-4 text-primary" />
                Cart Preview
              </div>
              {cartStore.totalItems > 0 && (
                <Badge variant="default" className="bg-primary/90 hover:bg-primary">
                  {cartStore.totalItems}
                </Badge>
              )}
            </button>
            <div className="flex justify-center">
              <ThemeToggle />
            </div>
          </div>
        </div>
      ) : (
        <div className="flex flex-col h-full">
          <div className="p-6">
            <Link href="/">
              <div className="flex items-center gap-3 cursor-pointer">
                <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center text-primary-foreground shadow-lg shadow-primary/20">
                  <MessageSquare className="w-5 h-5" />
                </div>
                <h1 className="font-display font-bold text-lg">Shopify Agent</h1>
                <span className="ml-2 flex items-center gap-1 px-2 py-0.5 rounded-full bg-violet-100 dark:bg-violet-500/20 text-violet-700 dark:text-violet-300 text-[10px] font-semibold">
                  <Shield className="w-3 h-3" />
                  UCP
                </span>
              </div>
            </Link>
          </div>
          <div className="mt-auto p-4 border-t border-border/50 flex justify-center">
            <ThemeToggle />
          </div>
        </div>
      )}
    </>
  );

  return (
    <div className="flex h-screen w-full bg-background overflow-hidden">
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex w-[280px] flex-col border-r border-border/50 bg-card/30 backdrop-blur-xl relative z-10" aria-label="Main navigation">
        <NavLinks />
      </aside>

      {/* Mobile Header & Content */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="md:hidden flex items-center justify-between px-4 py-3 border-b border-border/50 bg-background/80 backdrop-blur-md z-20">
          <Link href="/">
            <div className="flex items-center gap-2 font-display font-bold min-h-11">
              <StoreIcon className="w-5 h-5 text-primary" />
              <span className="truncate max-w-[150px]">{storeDomain || 'AI Agent'}</span>
              <span className="flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-violet-100 dark:bg-violet-500/20 text-violet-700 dark:text-violet-300 text-[9px] font-semibold">
                <Shield className="w-2.5 h-2.5" />
                UCP
              </span>
            </div>
          </Link>
          
          <div className="flex items-center gap-1">
            <ThemeToggle />
            {storeDomain && (
              <Button variant="ghost" size="icon" className="relative" onClick={() => cartStore.setIsOpen(true)} aria-label={`Open cart${cartStore.totalItems > 0 ? ` (${cartStore.totalItems} items)` : ''}`}>
                <ShoppingBag className="w-5 h-5" aria-hidden="true" />
                {cartStore.totalItems > 0 && (
                  <span className="absolute top-1 right-1 w-2 h-2 bg-primary rounded-full" aria-hidden="true" />
                )}
              </Button>
            )}
            <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" aria-label="Open navigation menu">
                  <Menu className="w-5 h-5" aria-hidden="true" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="p-0 w-[280px]" aria-describedby={undefined}>
                <SheetTitle className="sr-only">Navigation menu</SheetTitle>
                <NavLinks />
              </SheetContent>
            </Sheet>
          </div>
        </header>

        <main className={`flex-1 overflow-auto relative ${storeDomain ? 'pb-[var(--bottom-nav-height)] md:pb-0' : ''}`}>
          {/* Decorative background elements */}
          <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-primary/5 rounded-full blur-[100px] -z-10 pointer-events-none translate-x-1/2 -translate-y-1/2" />
          <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-accent/30 rounded-full blur-[80px] -z-10 pointer-events-none -translate-x-1/3 translate-y-1/3" />
          
          {children}
        </main>

        {/* Mobile Bottom Navigation */}
        {storeDomain && bottomNavItems.length > 0 && (
          <nav className="md:hidden fixed bottom-0 left-0 right-0 z-30 bg-background/95 backdrop-blur-md border-t border-border/50 safe-area-bottom" aria-label="Mobile navigation">
            <div className="flex items-stretch justify-around px-1">
              {bottomNavItems.map((item) => {
                const isActive = item.href === '#cart' ? false : (item.href === '/' ? location === '/' : location.startsWith(item.href));
                const handleClick = item.action ? (e: React.MouseEvent) => { e.preventDefault(); item.action!(); } : undefined;

                const content = (
                  <div
                    className={`flex flex-col items-center justify-center gap-1 py-2 min-h-[56px] min-w-[48px] flex-1 transition-colors ${
                      isActive ? 'text-primary' : 'text-muted-foreground'
                    }`}
                  >
                    <item.icon className="w-5 h-5" aria-hidden="true" />
                    <span className="text-[10px] font-medium leading-none">{item.name}</span>
                    {item.name === 'Cart' && cartStore.totalItems > 0 && (
                      <span className="absolute top-1.5 right-1/2 translate-x-3 w-2 h-2 bg-primary rounded-full" aria-hidden="true" />
                    )}
                  </div>
                );

                if (item.action) {
                  return (
                    <button key={item.name} onClick={handleClick} className="relative flex-1" aria-label={item.name}>
                      {content}
                    </button>
                  );
                }

                return (
                  <Link key={item.name} href={item.href} className="relative flex-1" aria-label={item.name} aria-current={isActive ? 'page' : undefined}>
                    {content}
                  </Link>
                );
              })}
            </div>
          </nav>
        )}
      </div>
    </div>
  );
}
