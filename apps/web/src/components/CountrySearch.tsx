import { useEffect, useId, useImperativeHandle, useRef, useState } from "react";
import type { KeyboardEvent, Ref } from "react";
import { z } from "zod";
import { api } from "../api";
const countriesSchema = z.array(
  z.object({
    id: z.string().min(1),
    name: z.string().min(1),
    iso2: z.string().optional(),
  }),
);
export type CountryOption = z.infer<typeof countriesSchema>[number];

export function CountrySearch({
  canSearch = true,
  onSelect,
  disabled = false,
  inputRef,
}: {
  canSearch?: boolean;
  onSelect?: (country: CountryOption) => void;
  disabled?: boolean;
  inputRef?: Ref<HTMLInputElement>;
}) {
  const listId = useId();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<CountryOption[]>([]);
  const [active, setActive] = useState(-1);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [selected, setSelected] = useState<CountryOption | null>(null);
  const optionRefs = useRef<(HTMLLIElement | null)[]>([]);
  const inputElement = useRef<HTMLInputElement>(null);
  useImperativeHandle(inputRef, () => inputElement.current!);
  useEffect(() => {
    const controller = new AbortController();
    let current = true;
    const text = query.trim();
    if (!text || selected || !canSearch || disabled) return;
    const timeout = window.setTimeout(async () => {
      try {
        const data = await api<unknown>(
          `countries/search?${new URLSearchParams({ q: text, limit: "10" })}`,
          undefined,
          true,
          controller.signal,
        );
        const parsed = countriesSchema.safeParse(data);
        if (!parsed.success)
          throw new Error(
            "Country search returned an unexpected response. Please try again later.",
          );
        if (!current) return;
        // Preserve server order: country matching and ranking belong on the API.
        setResults(parsed.data);
        setActive(-1);
        setMessage(
          parsed.data.length
            ? `${parsed.data.length} countries found.`
            : "No countries found. Try another name.",
        );
      } catch (error) {
        if (current && !controller.signal.aborted) {
          setResults([]);
          setMessage(
            error instanceof Error
              ? error.message
              : "Search failed. Please try again.",
          );
        }
      } finally {
        if (current) setLoading(false);
      }
    }, 250);
    return () => {
      current = false;
      window.clearTimeout(timeout);
      controller.abort();
    };
  }, [query, selected, canSearch, disabled]);
  useEffect(() => {
    optionRefs.current[active]?.scrollIntoView?.({ block: "nearest" });
  }, [active]);
  function choose(country: CountryOption) {
    setLoading(false);
    setSelected(country);
    setQuery(country.name);
    setOpen(false);
    setResults([]);
    setActive(-1);
    setMessage("");
  }
  useEffect(() => {
    if (selected) inputElement.current?.focus();
  }, [selected]);
  function keys(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Escape") {
      setOpen(false);
      setActive(-1);
      return;
    }
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      setOpen(true);
      if (results.length)
        setActive((index) =>
          event.key === "ArrowDown"
            ? (index + 1) % results.length
            : index <= 0
              ? results.length - 1
              : index - 1,
        );
    }
    if (event.key === "Enter") {
      event.preventDefault();
      if (event.repeat) return;
      if (selected) onSelect?.(selected);
      else if (open && active >= 0 && results[active]) choose(results[active]);
    }
  }
  return (
    <div
      className="country-search"
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
          setOpen(false);
          setActive(-1);
        }
      }}
    >
      <label htmlFor={`${listId}-input`}>Your next guess</label>
      <div className="preview-search">
        <input
          ref={inputElement}
          id={`${listId}-input`}
          role="combobox"
          autoComplete="off"
          aria-autocomplete="list"
          aria-expanded={!disabled && open && results.length > 0}
          aria-controls={
            !disabled && open && results.length > 0
              ? `${listId}-list`
              : undefined
          }
          aria-activedescendant={
            open && active >= 0 ? `${listId}-${active}` : undefined
          }
          aria-describedby={`${listId}-status`}
          value={query}
          disabled={disabled}
          placeholder="Search for a country"
          onKeyDown={keys}
          onFocus={() => setOpen(true)}
          onChange={(event) => {
            setQuery(event.target.value);
            setLoading(canSearch && Boolean(event.target.value.trim()));
            setSelected(null);
            setResults([]);
            setMessage("");
            setActive(-1);
            setOpen(true);
          }}
        />
        <button
          type="button"
          disabled={disabled || !selected}
          onClick={() => {
            if (selected) onSelect?.(selected);
          }}
        >
          Enter
        </button>
      </div>
      {!disabled && open && results.length > 0 && (
        <ul
          className="country-options"
          id={`${listId}-list`}
          role="listbox"
          aria-label="Country suggestions"
        >
          {results.map((country, index) => (
            <li
              id={`${listId}-${index}`}
              key={country.id}
              ref={(element) => {
                optionRefs.current[index] = element;
              }}
              role="option"
              tabIndex={0}
              aria-selected={index === active}
              onFocus={() => setActive(index)}
              onKeyDown={(event) => {
                if (event.key === "Escape") {
                  event.preventDefault();
                  inputElement.current?.focus();
                  setOpen(false);
                  setActive(-1);
                  return;
                }
                if (event.key === "Tab" || event.key === "ArrowDown" || event.key === "ArrowUp") {
                  event.preventDefault();
                  const backwards = event.key === "ArrowUp" || (event.key === "Tab" && event.shiftKey);
                  const next = (index + (backwards ? -1 : 1) + results.length) % results.length;
                  optionRefs.current[next]?.focus();
                  return;
                }
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  choose(country);
                }
              }}
              onMouseDown={(event) => event.preventDefault()}
              onMouseEnter={() => setActive(index)}
              onClick={() => choose(country)}
            >
              {country.name}
            </li>
          ))}
        </ul>
      )}
      <p
        className="search-status"
        id={`${listId}-status`}
        role="status"
        aria-busy={loading}
      >
        {!canSearch && query.trim()
          ? "Sign in to search countries."
          : loading
            ? ""
            : message}
      </p>
    </div>
  );
}
