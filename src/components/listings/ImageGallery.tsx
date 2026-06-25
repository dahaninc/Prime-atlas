"use client";

import { useState } from "react";

interface ImageGalleryProps {
  images: string[];
  title: string;
}

export function ImageGallery({ images, title }: ImageGalleryProps) {
  const [current, setCurrent] = useState(0);

  if (!images || images.length === 0) {
    return (
      <div className="h-72 rounded-xl bg-secondary/30 flex items-center justify-center">
        <p className="text-xs text-muted-foreground">No images available</p>
      </div>
    );
  }

  const prev = () => setCurrent((c) => (c - 1 + images.length) % images.length);
  const next = () => setCurrent((c) => (c + 1) % images.length);

  return (
    <div className="select-none">
      {/* Main image */}
      <div className="relative h-[380px] sm:h-[440px] rounded-xl overflow-hidden bg-secondary/30">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={images[current]}
          alt={`${title} — image ${current + 1}`}
          className="w-full h-full object-cover transition-opacity duration-300"
        />

        {/* Gradient overlay bottom */}
        <div className="absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-black/50 to-transparent pointer-events-none" />

        {/* Counter badge */}
        <div className="absolute top-3 right-3 bg-black/60 backdrop-blur-sm text-white text-xs font-mono px-2.5 py-1 rounded-full">
          {current + 1} / {images.length}
        </div>

        {/* Nav arrows */}
        {images.length > 1 && (
          <>
            <button
              onClick={prev}
              aria-label="Previous image"
              className="absolute left-3 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-black/60 backdrop-blur-sm text-white flex items-center justify-center hover:bg-black/80 transition-colors text-lg font-bold"
            >
              ‹
            </button>
            <button
              onClick={next}
              aria-label="Next image"
              className="absolute right-3 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-black/60 backdrop-blur-sm text-white flex items-center justify-center hover:bg-black/80 transition-colors text-lg font-bold"
            >
              ›
            </button>
          </>
        )}
      </div>

      {/* Thumbnails */}
      {images.length > 1 && (
        <div className="flex gap-2 mt-2.5 overflow-x-auto pb-1">
          {images.map((img, i) => (
            <button
              key={i}
              onClick={() => setCurrent(i)}
              aria-label={`View image ${i + 1}`}
              className={`flex-shrink-0 w-20 h-14 rounded-lg overflow-hidden border-2 transition-colors ${
                i === current
                  ? "border-pa-green"
                  : "border-transparent opacity-60 hover:opacity-100"
              }`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={img} alt="" className="w-full h-full object-cover" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
