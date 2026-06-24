import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { getTheme } from "../../../utils/themes";
import { useLocation } from "../../../hooks/useLocation";
import { getHomePromoStrip } from "../../../services/api/customerHomeService";
import { getSubcategories } from "../../../services/api/categoryService";
import { calculateProductPrice } from "../../../utils/priceUtils";
import { getProductShopName } from "../../../utils/productDisplay";

interface PromoSectionProps {
  activeTab?: string;
}

interface CategoryCard {
  id: string;
  title: string;
  badge: string;
  discountPercentage: number;
  slug?: string;
  categoryId?: string;
  image?: string;
  subcategoryImages: string[];
}

interface FeaturedProduct {
  id: string;
  name: string;
  imageUrl?: string;
  mrp: number;
  price: number;
  discount: number;
  shopName?: string;
}

const formatDateShort = (d: Date) =>
  d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });

const buildCountdown = (end: Date) => {
  const diff = end.getTime() - Date.now();
  if (diff <= 0) return null;
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  return { days, hours, mins };
};

export default function PromoSection({ activeTab = "all" }: PromoSectionProps) {
  const { location } = useLocation();
  const navigate = useNavigate();
  const theme = getTheme(activeTab);
  const scrollerRef = useRef<HTMLDivElement>(null);

  const [loading, setLoading] = useState(true);
  const [heading, setHeading] = useState<string>("");
  const [saleText, setSaleText] = useState<string>("SALE");
  const [tagline, setTagline] = useState<string>("");
  const [startDate, setStartDate] = useState<Date | null>(null);
  const [endDate, setEndDate] = useState<Date | null>(null);
  const [crazyDealsTitle, setCrazyDealsTitle] = useState("CRAZY DEALS");
  const [categoryCards, setCategoryCards] = useState<CategoryCard[]>([]);
  const [featured, setFeatured] = useState<FeaturedProduct[]>([]);
  const [subcatImages, setSubcatImages] = useState<Record<string, string[]>>({});
  const [countdown, setCountdown] = useState<{ days: number; hours: number; mins: number } | null>(null);

  const fetchSubcatImages = useCallback(async (cards: CategoryCard[]) => {
    setTimeout(async () => {
      const map: Record<string, string[]> = {};
      const batchSize = 2;
      for (let i = 0; i < cards.length; i += batchSize) {
        const batch = cards.slice(i, i + batchSize);
        await Promise.all(
          batch.map(async (card) => {
            const categoryId = card.categoryId;
            if (!categoryId) return;
            try {
              const res = await getSubcategories(categoryId, { limit: 4 });
              if (res.success && res.data) {
                const images = res.data
                  .filter((s) => s.subcategoryImage)
                  .map((s) => s.subcategoryImage!)
                  .slice(0, 4);
                if (images.length > 0) map[card.id] = images;
              }
            } catch {
              // silently fall back to placeholders
            }
          })
        );
        if (i + batchSize < cards.length) {
          await new Promise((r) => setTimeout(r, 50));
        }
      }
      setSubcatImages(map);
    }, 200);
  }, []);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      setLoading(true);
      try {
        const response = await getHomePromoStrip(
          activeTab,
          location?.latitude,
          location?.longitude,
          true,
          5 * 60 * 1000
        );

        if (cancelled) return;

        const promo = response?.data?.promoStrip;
        if (!promo || !promo.isActive) {
          setHeading("");
          setCategoryCards([]);
          setFeatured([]);
          return;
        }

        setHeading(promo.heading || "");
        setSaleText(promo.saleText || "SALE");
        setTagline(promo.tagline || "Hand-picked deals just for you");
        setCrazyDealsTitle(promo.crazyDealsTitle || "CRAZY DEALS");

        if (promo.startDate) setStartDate(new Date(promo.startDate));
        if (promo.endDate) setEndDate(new Date(promo.endDate));

        if (Array.isArray(promo.categoryCards)) {
          const cards: CategoryCard[] = promo.categoryCards
            .slice()
            .sort((a: any, b: any) => (a.order || 0) - (b.order || 0))
            .map((card: any) => {
              const cat = typeof card.categoryId === "object" ? card.categoryId : null;
              const categoryId =
                cat?._id ||
                (typeof card.categoryId === "string" && /^[0-9a-fA-F]{24}$/.test(card.categoryId)
                  ? card.categoryId
                  : undefined);
              return {
                id: card._id || categoryId || Math.random().toString(36),
                title: card.title || cat?.name || "Category",
                badge:
                  card.badge ||
                  `Up to ${card.discountPercentage || 0}% OFF`,
                discountPercentage: card.discountPercentage || 0,
                slug: cat?.slug || (typeof card.categoryId === "string" ? card.categoryId : undefined),
                categoryId,
                image: cat?.image,
                subcategoryImages: [],
              };
            });
          setCategoryCards(cards);
          if (cards.length > 0) fetchSubcatImages(cards);
        }

        if (Array.isArray(promo.featuredProducts)) {
          const list: FeaturedProduct[] = promo.featuredProducts
            .map((p: any) => {
              const product = typeof p === "object" ? p : null;
              if (!product) return null;
              const { displayPrice, mrp, discount } = calculateProductPrice(product);
              const image =
                product.mainImage ||
                product.mainImageUrl ||
                product.image ||
                product.imageUrl ||
                (product.galleryImageUrls?.[0]) ||
                (product.galleryImages?.[0]) ||
                undefined;
              return {
                id: String(product._id || product.id || ""),
                name: product.productName || product.name || "Product",
                imageUrl: image,
                mrp: Number.isFinite(mrp) ? mrp : 0,
                price: Number.isFinite(displayPrice) ? displayPrice : 0,
                discount: Number.isFinite(discount) ? discount : 0,
                shopName: getProductShopName(product) || undefined,
              };
            })
            .filter(Boolean) as FeaturedProduct[];
          setFeatured(list);
        }
      } catch (err) {
        console.error("PromoSection fetch error", err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    run();
    return () => {
      cancelled = true;
    };
  }, [activeTab, location?.latitude, location?.longitude, fetchSubcatImages]);

  useEffect(() => {
    if (!endDate) return;
    const tick = () => setCountdown(buildCountdown(endDate));
    tick();
    const id = setInterval(tick, 60_000);
    return () => clearInterval(id);
  }, [endDate]);

  const dateRangeLabel = useMemo(() => {
    if (!startDate || !endDate) return "";
    return `${formatDateShort(startDate)} – ${formatDateShort(endDate)}`;
  }, [startDate, endDate]);

  const scrollByOffset = (offset: number) => {
    scrollerRef.current?.scrollBy({ left: offset, behavior: "smooth" });
  };

  if (loading) {
    return (
      <div className="px-4 md:px-6 lg:px-8 mt-4">
        <div className="rounded-2xl bg-neutral-100 animate-pulse h-56 md:h-64" />
      </div>
    );
  }

  if (!heading && categoryCards.length === 0 && featured.length === 0) {
    return null;
  }

  const maxDiscount = Math.max(
    ...categoryCards.map((c) => c.discountPercentage || 0),
    ...featured.map((f) => f.discount || 0),
    0
  );

  // Build a vibrant sale-colored gradient: blend theme tones with hot sale reds/oranges
  const heroBg = `linear-gradient(135deg, #FF4D4D 0%, #FF7A1A 35%, ${theme.primary[0]} 100%)`;

  return (
    <section
      aria-label="Promotional offers"
      className="px-4 md:px-6 lg:px-8 mt-4 md:mt-6"
    >
      {/* Local keyframes for sale animations */}
      <style>{`
        @keyframes promo-marquee { 0% { transform: translateX(0); } 100% { transform: translateX(-50%); } }
        @keyframes promo-shine { 0% { transform: translateX(-120%) skewX(-20deg); } 100% { transform: translateX(220%) skewX(-20deg); } }
        @keyframes promo-tilt { 0%, 100% { transform: rotate(-6deg) scale(1); } 50% { transform: rotate(-6deg) scale(1.04); } }
        @keyframes promo-flame { 0%, 100% { transform: scale(1) translateY(0); } 50% { transform: scale(1.15) translateY(-1px); } }
      `}</style>

      {/* TOP MARQUEE STRIP */}
      <div className="relative overflow-hidden rounded-t-2xl md:rounded-t-3xl bg-black text-white py-1.5">
        <div
          className="flex whitespace-nowrap will-change-transform"
          style={{ animation: "promo-marquee 22s linear infinite" }}
        >
          {Array.from({ length: 2 }).map((_, i) => (
            <div key={i} className="flex shrink-0 items-center gap-6 px-4 text-[11px] md:text-xs font-bold tracking-wider uppercase">
              <span className="inline-flex items-center gap-1.5"><span className="text-yellow-400">★</span> Mega Sale Live</span>
              <span className="opacity-60">•</span>
              <span>Free Delivery Over ₹499</span>
              <span className="opacity-60">•</span>
              <span className="inline-flex items-center gap-1.5">🔥 Up to {maxDiscount || 80}% Off</span>
              <span className="opacity-60">•</span>
              <span>Limited Time Only</span>
              <span className="opacity-60">•</span>
              <span className="inline-flex items-center gap-1.5">⚡ Flash Deals Every Hour</span>
              <span className="opacity-60">•</span>
            </div>
          ))}
        </div>
      </div>

      {/* HERO BANNER */}
      <div
        className="relative overflow-hidden rounded-b-2xl md:rounded-b-3xl shadow-lg shadow-red-200/40 ring-1 ring-black/5"
        style={{ background: heroBg }}
      >
        {/* Diagonal sale stripes overlay */}
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.12]"
          style={{
            backgroundImage:
              "repeating-linear-gradient(135deg, #fff 0 14px, transparent 14px 32px)",
          }}
        />
        {/* Soft radial highlight */}
        <div
          className="pointer-events-none absolute -top-20 -right-16 w-72 h-72 rounded-full opacity-40 blur-3xl"
          style={{ background: "#FFEB3B" }}
        />

        {/* Decorative corner tape */}
        <div className="pointer-events-none absolute top-3 left-3 md:top-4 md:left-4 rotate-[-6deg]">
          <div className="bg-yellow-400 text-black text-[10px] md:text-[11px] font-black uppercase tracking-wider px-2.5 py-1 rounded shadow-md">
            Limited Drop
          </div>
        </div>

        <div className="relative p-5 pt-12 md:p-8 md:pt-14 flex flex-col md:flex-row md:items-center md:justify-between gap-5">
          {/* LEFT — text content */}
          <div className="flex-1 min-w-0">
            {/* Date pill */}
            {dateRangeLabel && (
              <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] md:text-[11px] font-bold tracking-wide uppercase bg-white/95 text-neutral-900 shadow-sm">
                <span className="relative flex h-1.5 w-1.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-500 opacity-75" />
                  <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-red-500" />
                </span>
                Live · {dateRangeLabel}
              </div>
            )}

            {/* Big heading */}
            <h2 className="mt-2.5 text-3xl md:text-5xl font-black tracking-tight leading-[1.05] text-white drop-shadow-[0_2px_0_rgba(0,0,0,0.18)]">
              {heading}
            </h2>

            {/* SALE tape ribbon */}
            <div className="mt-2 inline-flex items-center">
              <span className="relative inline-block bg-yellow-300 text-red-700 px-3 py-1 text-base md:text-xl font-black tracking-widest uppercase shadow-[0_4px_0_rgba(0,0,0,0.15)] rotate-[-2deg]">
                {saleText}
                {/* shine sweep */}
                <span
                  className="pointer-events-none absolute inset-0 overflow-hidden rounded-sm"
                  aria-hidden
                >
                  <span
                    className="block h-full w-1/3 bg-white/50"
                    style={{ animation: "promo-shine 2.6s ease-in-out infinite" }}
                  />
                </span>
              </span>
            </div>

            {tagline && (
              <p className="mt-2.5 text-sm md:text-base text-white/90 max-w-md font-medium">
                {tagline}
              </p>
            )}

            {/* Countdown */}
            {countdown && (
              <div className="mt-4 flex items-center gap-2.5">
                <span className="text-[10px] md:text-xs font-bold uppercase tracking-wider text-white/95">
                  Ends in
                </span>
                <div className="flex items-center gap-1.5">
                  {[
                    { label: "D", value: countdown.days },
                    { label: "H", value: countdown.hours },
                    { label: "M", value: countdown.mins },
                  ].map((c, idx, arr) => (
                    <div key={c.label} className="flex items-center gap-1.5">
                      <div className="bg-black/85 text-white rounded-md px-2 py-1.5 min-w-[40px] text-center shadow-md">
                        <div className="text-base md:text-lg font-black leading-none tabular-nums">
                          {String(c.value).padStart(2, "0")}
                        </div>
                        <div className="text-[9px] font-bold opacity-70 mt-0.5">{c.label}</div>
                      </div>
                      {idx < arr.length - 1 && (
                        <span className="text-white/80 font-black text-lg">:</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* RIGHT — starburst discount badge */}
          {maxDiscount > 0 && (
            <div className="flex-shrink-0 self-center md:self-auto">
              <div
                className="relative w-28 h-28 md:w-36 md:h-36 flex items-center justify-center"
                style={{ animation: "promo-tilt 2.2s ease-in-out infinite" }}
              >
                {/* Starburst SVG */}
                <svg viewBox="0 0 100 100" className="absolute inset-0 w-full h-full drop-shadow-lg">
                  <defs>
                    <linearGradient id="burstFill" x1="0" y1="0" x2="1" y2="1">
                      <stop offset="0%" stopColor="#FFD400" />
                      <stop offset="100%" stopColor="#FF8A00" />
                    </linearGradient>
                  </defs>
                  <polygon
                    fill="url(#burstFill)"
                    stroke="#fff"
                    strokeWidth="1.5"
                    points="50,2 56,18 72,8 70,26 88,22 78,38 96,44 80,52 96,62 78,66 88,82 70,78 72,96 56,86 50,98 44,86 28,96 30,78 12,82 22,66 4,62 20,52 4,44 22,38 12,22 30,26 28,8 44,18"
                  />
                </svg>
                <div className="relative flex flex-col items-center text-red-700 leading-none">
                  <span className="text-[9px] md:text-[10px] font-bold tracking-widest">UP TO</span>
                  <span className="text-3xl md:text-4xl font-black mt-0.5">{maxDiscount}%</span>
                  <span className="text-[10px] md:text-xs font-black tracking-[0.2em] mt-0.5">OFF</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Bottom info bar inside hero */}
        <div className="relative bg-black/85 text-white text-[10px] md:text-xs font-bold uppercase tracking-wider px-4 py-2 flex items-center justify-between gap-2 flex-wrap">
          <span className="inline-flex items-center gap-1.5">🚚 Free shipping over ₹499</span>
          <span className="inline-flex items-center gap-1.5">⚡ Lightning fast delivery</span>
          <span className="inline-flex items-center gap-1.5">🔒 100% Secure</span>
        </div>
      </div>

      {/* FEATURED PRODUCTS */}
      {featured.length > 0 && (
        <div className="mt-6">
          <div className="flex items-end justify-between mb-3">
            <div>
              <h3 className="text-base md:text-xl font-black text-neutral-900 tracking-tight inline-flex items-center gap-2">
                <span style={{ animation: "promo-flame 1.4s ease-in-out infinite", display: "inline-block" }}>🔥</span>
                {crazyDealsTitle}
              </h3>
              <p className="text-xs text-red-600 font-bold mt-0.5 inline-flex items-center gap-1.5">
                <span className="relative flex h-1.5 w-1.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-500 opacity-75" />
                  <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-red-500" />
                </span>
                Selling fast · Limited stock
              </p>
            </div>
            <div className="hidden md:flex items-center gap-2">
              <button
                onClick={() => scrollByOffset(-320)}
                aria-label="Scroll left"
                className="w-9 h-9 rounded-full border border-neutral-200 bg-white hover:bg-neutral-50 flex items-center justify-center text-neutral-700 shadow-sm transition-colors"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                  <path d="M15 18L9 12L15 6" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
              <button
                onClick={() => scrollByOffset(320)}
                aria-label="Scroll right"
                className="w-9 h-9 rounded-full border border-neutral-200 bg-white hover:bg-neutral-50 flex items-center justify-center text-neutral-700 shadow-sm transition-colors"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                  <path d="M9 18L15 12L9 6" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
            </div>
          </div>

          <div
            ref={scrollerRef}
            className="flex gap-3 overflow-x-auto snap-x snap-mandatory pb-2 -mx-1 px-1"
            style={{ scrollbarWidth: "none" }}
          >
            {featured.map((p, idx) => {
              const isHot = idx < 3 && p.discount >= 20;
              const stockPct = 30 + ((idx * 17) % 50); // pseudo-randomised scarcity hint
              return (
                <button
                  key={p.id}
                  onClick={() => p.id && navigate(`/product/${p.id}`)}
                  className="snap-start flex-shrink-0 w-[160px] md:w-[180px] text-left bg-white rounded-2xl border border-neutral-200 hover:border-red-300 hover:shadow-xl hover:-translate-y-0.5 transition-all overflow-hidden group relative"
                >
                  {/* Top corner ribbon for hot items */}
                  {isHot && (
                    <div className="absolute top-2 right-2 z-10">
                      <span className="bg-red-600 text-white text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded shadow-md inline-flex items-center gap-0.5">
                        🔥 Hot
                      </span>
                    </div>
                  )}

                  <div className="relative aspect-square bg-gradient-to-br from-neutral-50 to-neutral-100 overflow-hidden">
                    {p.imageUrl ? (
                      <img
                        src={p.imageUrl}
                        alt={p.name}
                        className="w-full h-full object-contain p-3 group-hover:scale-110 transition-transform duration-500"
                        loading="lazy"
                        decoding="async"
                        referrerPolicy="no-referrer"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-neutral-300">
                        <svg width="40" height="40" viewBox="0 0 24 24" fill="none">
                          <rect x="3" y="3" width="18" height="18" rx="2" stroke="currentColor" strokeWidth="2" />
                          <path d="M3 16L8 11L21 21" stroke="currentColor" strokeWidth="2" />
                          <circle cx="9" cy="9" r="2" stroke="currentColor" strokeWidth="2" />
                        </svg>
                      </div>
                    )}
                    {p.discount > 0 && (
                      <span className="absolute top-2 left-2 px-1.5 py-0.5 rounded-md text-[10px] font-black text-white bg-red-600 shadow-md">
                        -{p.discount}%
                      </span>
                    )}
                  </div>
                  <div className="p-2.5">
                    <p className="text-xs md:text-sm font-semibold text-neutral-900 line-clamp-2 min-h-[2.2em]">
                      {p.name}
                    </p>
                    {p.shopName && (
                      <p className="text-[10px] text-neutral-500 line-clamp-1 mt-0.5">
                        {p.shopName}
                      </p>
                    )}
                    <div className="mt-1.5 flex items-baseline gap-1.5">
                      <span className="text-base md:text-lg font-black text-red-600">
                        ₹{Math.round(p.price)}
                      </span>
                      {p.mrp > p.price && (
                        <span className="text-[11px] text-neutral-400 line-through">
                          ₹{Math.round(p.mrp)}
                        </span>
                      )}
                    </div>
                    {/* Scarcity bar */}
                    <div className="mt-2">
                      <div className="h-1 w-full bg-neutral-200 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-orange-500 to-red-600"
                          style={{ width: `${stockPct}%` }}
                        />
                      </div>
                      <p className="mt-0.5 text-[9px] font-bold text-neutral-500 uppercase tracking-wider">
                        Only few left
                      </p>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* CATEGORY CARDS */}
      {categoryCards.length > 0 && (
        <div className="mt-6">
          <div className="mb-3 flex items-end justify-between">
            <div>
              <h3 className="text-base md:text-xl font-black text-neutral-900 tracking-tight inline-flex items-center gap-2">
                <span>🛍️</span> Shop the Sale
              </h3>
              <p className="text-xs text-neutral-500">Mega discounts across categories</p>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {categoryCards.map((card) => {
              const images = subcatImages[card.id] || card.subcategoryImages || [];
              const target =
                card.slug || card.categoryId
                  ? `/category/${card.slug || card.categoryId}`
                  : "#";
              return (
                <Link
                  key={card.id}
                  to={target}
                  className="group relative bg-white rounded-2xl border border-neutral-200 hover:border-red-300 hover:shadow-xl hover:-translate-y-0.5 transition-all overflow-hidden flex flex-col"
                >
                  {/* Sale ribbon banner on top */}
                  <div className="relative bg-gradient-to-r from-red-600 via-orange-500 to-yellow-400 text-white px-3 py-1.5 flex items-center justify-between overflow-hidden">
                    <span className="text-[10px] md:text-[11px] font-black uppercase tracking-wider drop-shadow">
                      Mega Deal
                    </span>
                    <span className="text-xs md:text-sm font-black drop-shadow">
                      {card.badge}
                    </span>
                    {/* shine sweep */}
                    <span
                      className="pointer-events-none absolute top-0 left-0 h-full w-1/3 bg-white/30"
                      style={{ animation: "promo-shine 3.4s ease-in-out infinite" }}
                    />
                  </div>

                  <div className="p-3 flex flex-col flex-1">
                    <h4 className="text-sm font-bold text-neutral-900 leading-tight line-clamp-2">
                      {card.title}
                    </h4>

                    {/* Subcategory image strip */}
                    <div className="mt-3 flex items-center gap-1.5">
                      {(images.length > 0 ? images.slice(0, 4) : [null, null, null, null]).map(
                        (img, idx) => (
                          <div
                            key={idx}
                            className="flex-1 aspect-square rounded-lg bg-neutral-50 border border-neutral-100 overflow-hidden flex items-center justify-center"
                          >
                            {img ? (
                              <img
                                src={img}
                                alt=""
                                className="w-full h-full object-cover"
                                loading="lazy"
                                decoding="async"
                                onError={(e) => {
                                  (e.target as HTMLImageElement).style.display = "none";
                                }}
                              />
                            ) : (
                              <div className="w-2 h-2 rounded-full bg-neutral-200" />
                            )}
                          </div>
                        )
                      )}
                    </div>

                    <span className="mt-3 text-[11px] font-bold text-red-600 group-hover:text-red-700 transition-colors inline-flex items-center gap-1 uppercase tracking-wider">
                      Grab the deal
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none">
                        <path d="M5 12H19M19 12L12 5M19 12L12 19" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </span>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      )}
    </section>
  );
}
