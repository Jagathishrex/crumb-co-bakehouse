import { Logo } from "@/components/logo";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Clock, MapPin, Phone, Wheat } from "lucide-react";

const todaysBakes = [
  { name: "Country sourdough", note: "Out at 7:30", left: "Plenty" },
  { name: "Cardamom buns", note: "Out at 8:00", left: "Going fast" },
  { name: "Seeded rye", note: "Out at 9:00", left: "Plenty" },
  { name: "Almond croissant", note: "Out at 7:30", left: "6 left" },
];

const breads = [
  { name: "Country sourdough", desc: "Long-fermented, blistered crust, open crumb", price: "$7.50" },
  { name: "Seeded rye", desc: "Sunflower, flax and caraway, dense and sweet", price: "$8.00" },
  { name: "Seeded baguette", desc: "Baked twice daily, crackles when torn", price: "$4.50" },
  { name: "Rosemary focaccia", desc: "Olive oil, flaky salt, a slab to share", price: "$9.00" },
  { name: "Milk loaf", desc: "Soft white sandwich bread, sliced on request", price: "$6.00" },
];

const pastries = [
  { name: "Butter croissant", desc: "27 layers, laminated by hand overnight", price: "$3.75" },
  { name: "Almond croissant", desc: "Twice-baked with frangipane and toasted flakes", price: "$4.50" },
  { name: "Cardamom bun", desc: "Swedish-style knot, pearl sugar", price: "$4.25" },
  { name: "Plum & thyme galette", desc: "Seasonal fruit, rye crust", price: "$5.00" },
  { name: "Brown butter cookie", desc: "Dark chocolate, sea salt", price: "$3.25" },
];

const hours = [
  { day: "Monday", time: "Closed" },
  { day: "Tuesday – Friday", time: "7:00 am – 5:00 pm" },
  { day: "Saturday", time: "7:30 am – 4:00 pm" },
  { day: "Sunday", time: "8:00 am – 2:00 pm" },
];

function MenuList({ title, items }: { title: string; items: typeof breads }) {
  return (
    <div className="flex flex-col">
      <h3 className="font-serif text-3xl font-semibold">{title}</h3>
      <Separator className="my-4 bg-foreground/60" />
      <ul className="flex flex-col gap-5">
        {items.map((i) => (
          <li key={i.name} className="flex items-baseline gap-3">
            <div className="flex-1">
              <p className="font-serif text-lg font-semibold">{i.name}</p>
              <p className="type-small text-muted-foreground">{i.desc}</p>
            </div>
            <span className="font-serif text-lg font-semibold text-primary">{i.price}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function Home() {
  return (
    <div className="flex min-h-screen w-full flex-col bg-background text-foreground">
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-8 py-6">
        <div className="flex items-center gap-3">
          <Logo className="size-9" />
          <span className="font-serif text-2xl font-bold">Crumb &amp; Co</span>
        </div>
        <nav className="flex items-center gap-8 type-small font-medium">
          <a href="#menu">Menu</a>
          <a href="#hours">Hours</a>
          <a href="#find-us">Find us</a>
        </nav>
      </header>

      <section className="mx-auto grid w-full max-w-6xl grid-cols-2 items-center gap-12 px-8 pb-20 pt-8">
        <div className="flex flex-col items-start gap-6">
          <Badge variant="secondary" className="gap-2 px-3 py-1">
            <Wheat className="size-3.5" /> Baking since 2014 on Alder Street
          </Badge>
          <h1 className="font-serif text-6xl font-bold leading-[1.02] tracking-tight">
            Bread worth getting up early for.
          </h1>
          <p className="type-body max-w-md text-muted-foreground">
            Small-batch loaves and laminated pastries, made each morning with stone-milled flour and a starter we have kept going for ten years.
          </p>
          <div className="flex gap-3">
            <Button size="lg" className="h-12 px-6" asChild>
              <a href="#menu">See the menu</a>
            </Button>
            <Button size="lg" variant="outline" className="h-12 px-6" asChild>
              <a href="#find-us">Find the shop</a>
            </Button>
          </div>
        </div>
        <div className="relative">
          <img src="/images/hero-bread.webp" alt="Loaves of sourdough on a bakery counter" className="h-[460px] w-full rounded-t-[200px] rounded-b-2xl object-cover" />
        </div>
      </section>

      <section className="bg-crust text-crust-foreground">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-8 py-14">
          <div className="flex items-end justify-between">
            <div>
              <p className="type-caption font-semibold uppercase tracking-[0.2em] text-accent">Fresh today · Friday 27 November</p>
              <h2 className="mt-2 font-serif text-4xl font-bold">Today's bakes</h2>
            </div>
            <p className="type-small max-w-xs text-crust-foreground/70">When it's gone, it's gone. We don't bake a second round of sourdough.</p>
          </div>
          <div className="grid grid-cols-4 gap-4">
            {todaysBakes.map((b) => (
              <div key={b.name} className="flex flex-col gap-3 rounded-xl border border-crust-foreground/15 p-5">
                <p className="font-serif text-xl font-semibold">{b.name}</p>
                <p className="type-small text-crust-foreground/70">{b.note}</p>
                <span className="mt-2 w-fit rounded-full bg-accent px-3 py-1 type-caption font-semibold text-accent-foreground">{b.left}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="menu" className="mx-auto w-full max-w-6xl px-8 py-24">
        <div className="mb-14 flex flex-col gap-3">
          <p className="type-caption font-semibold uppercase tracking-[0.2em] text-primary">The menu</p>
          <h2 className="font-serif text-5xl font-bold">Breads &amp; pastries</h2>
        </div>
        <div className="grid grid-cols-[1fr_1fr] gap-16">
          <MenuList title="Breads" items={breads} />
          <MenuList title="Pastries" items={pastries} />
        </div>
        <img src="/images/pastries.webp" alt="Croissants and pastries on display in a bakery" className="mt-16 h-72 w-full rounded-2xl object-cover" />
        <p className="type-caption mt-2 text-muted-foreground">Photo: philip.mallis, CC BY-SA 2.0 · Bread photo: jeffreyw, CC BY 2.0</p>
      </section>

      <section id="hours" className="bg-secondary">
        <div className="mx-auto grid w-full max-w-6xl grid-cols-2 gap-16 px-8 py-24">
          <div className="flex flex-col gap-4">
            <p className="type-caption font-semibold uppercase tracking-[0.2em] text-primary">Opening hours</p>
            <h2 className="font-serif text-5xl font-bold">Come by before the racks empty.</h2>
            <p className="type-body max-w-sm text-muted-foreground">Sourdough is out by 7:30. Pastries usually sell out by noon on weekends, so earlier is better.</p>
          </div>
          <div className="flex flex-col rounded-2xl bg-card p-8">
            <div className="mb-2 flex items-center gap-2 text-primary">
              <Clock className="size-5" />
              <span className="type-small font-semibold">Open now · closes 5:00 pm</span>
            </div>
            {hours.map((h, i) => (
              <div key={h.day}>
                <Separator className={i === 0 ? "hidden" : "my-4"} />
                <div className="flex items-baseline justify-between pt-3 first:pt-3">
                  <span className="font-serif text-xl font-semibold">{h.day}</span>
                  <span className={h.time === "Closed" ? "text-muted-foreground" : "font-medium"}>{h.time}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="find-us" className="mx-auto grid w-full max-w-6xl grid-cols-2 gap-16 px-8 py-24">
        <div className="flex flex-col gap-6">
          <p className="type-caption font-semibold uppercase tracking-[0.2em] text-primary">Find us</p>
          <h2 className="font-serif text-5xl font-bold">On the corner of Alder &amp; 4th.</h2>
          <div className="flex flex-col gap-4">
            <div className="flex items-start gap-3">
              <MapPin className="mt-1 size-5 text-primary" />
              <p className="type-body">42 Alder Street<br />Maplewood, OR 97214<br />Next to the post office, under the green awning</p>
            </div>
            <div className="flex items-center gap-3">
              <Phone className="size-5 text-primary" />
              <p className="type-body">(503) 555-0142 · call before 4 pm to hold a loaf</p>
            </div>
          </div>
          <Button size="lg" className="h-12 w-fit px-6">Get directions</Button>
        </div>
        <div className="relative h-[380px] overflow-hidden rounded-2xl border border-border bg-muted">
          <svg viewBox="0 0 400 380" className="absolute inset-0 size-full" aria-hidden="true">
            <rect width="400" height="380" fill="none" />
            <path d="M0 250H400M0 110H400M110 0V380M290 0V380" stroke="oklch(0.99 0.01 85)" strokeWidth="22" />
            <path d="M0 250H400M110 0V380" stroke="oklch(0.85 0.09 80)" strokeWidth="2" strokeDasharray="10 8" />
            <rect x="130" y="130" width="140" height="100" rx="8" fill="oklch(0.88 0.05 140)" opacity="0.6" />
            <text x="150" y="185" fontSize="13" fill="oklch(0.4 0.04 140)">Alder Park</text>
            <text x="14" y="244" fontSize="12" fill="oklch(0.46 0.04 55)">Alder Street</text>
            <text x="116" y="30" fontSize="12" fill="oklch(0.46 0.04 55)">4th Ave</text>
          </svg>
          <div className="absolute left-[27.5%] top-[56%] flex -translate-x-1/2 -translate-y-full flex-col items-center">
            <span className="rounded-full bg-primary px-3 py-1.5 type-small font-semibold text-primary-foreground shadow-md">Crumb &amp; Co</span>
            <span className="size-3 -translate-y-1.5 rotate-45 bg-primary" />
          </div>
        </div>
      </section>

      <footer className="bg-crust text-crust-foreground">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-8 py-8">
          <div className="flex items-center gap-3">
            <Logo className="size-7" />
            <span className="font-serif text-lg font-semibold">Crumb &amp; Co</span>
          </div>
          <p className="type-small text-crust-foreground/70">© 2026 Crumb &amp; Co · 42 Alder Street</p>
        </div>
      </footer>
    </div>
  );
}
