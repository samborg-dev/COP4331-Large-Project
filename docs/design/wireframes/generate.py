"""Generates the low-fidelity wireframe sheets (web.svg and mobile.svg) for CountryGuesser.

    python docs/design/wireframes/generate.py

The screens, labels and routes mirror apps/web (React) and apps/mobile (Flutter). Export the
SVGs to PNG for the slides (the PNGs in this folder were rendered in a browser at 2x).
"""
from html import escape
from pathlib import Path

INK, MUTED, LINE, FILL, SOFT, ACCENT = "#1f2937", "#64748b", "#475569", "#ffffff", "#f1f5f9", "#334155"
FONT = "Segoe UI, Helvetica, Arial, sans-serif"


class Sheet:
    def __init__(self, w, h, title, subtitle):
        self.w, self.h, self.out = w, h, []
        self.text(30, 38, title, 24, 700)
        self.text(30, 60, subtitle, 13, 400, MUTED)

    def add(self, s):
        self.out.append(s)

    def rect(self, x, y, w, h, fill=FILL, stroke=LINE, sw=1.5, rx=6, dash=None):
        d = f' stroke-dasharray="{dash}"' if dash else ""
        self.add(f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="{rx}" fill="{fill}" stroke="{stroke}" stroke-width="{sw}"{d}/>')

    def text(self, x, y, s, size=12, weight=400, fill=INK, anchor="start", italic=False, underline=False):
        st = ' font-style="italic"' if italic else ""
        ul = ' text-decoration="underline"' if underline else ""
        self.add(f'<text x="{x}" y="{y}" font-size="{size}" font-weight="{weight}" fill="{fill}" text-anchor="{anchor}"{st}{ul}>{escape(s)}</text>')

    def line(self, x1, y1, x2, y2, stroke=LINE, sw=1.2, dash=None):
        d = f' stroke-dasharray="{dash}"' if dash else ""
        self.add(f'<line x1="{x1}" y1="{y1}" x2="{x2}" y2="{y2}" stroke="{stroke}" stroke-width="{sw}"{d}/>')

    def circle(self, cx, cy, r, fill=SOFT, stroke=LINE, sw=1.5):
        self.add(f'<circle cx="{cx}" cy="{cy}" r="{r}" fill="{fill}" stroke="{stroke}" stroke-width="{sw}"/>')

    # ---- widgets
    def field(self, x, y, w, label, hint="", h=28, size=11):
        self.text(x, y - 5, label, size, 600)
        self.rect(x, y, w, h, rx=4)
        if hint:
            self.text(x + 8, y + h / 2 + 4, hint, size, 400, "#94a3b8")

    def button(self, x, y, w, label, primary=True, h=30, size=12):
        self.rect(x, y, w, h, fill=ACCENT if primary else FILL, rx=5)
        self.text(x + w / 2, y + h / 2 + 4, label, size, 600, "#ffffff" if primary else INK, "middle")

    def link(self, x, y, s, size=11, anchor="start"):
        self.text(x, y, s, size, 400, ACCENT, anchor, underline=True)

    def globe(self, cx, cy, r):
        self.circle(cx, cy, r)
        self.add(f'<ellipse cx="{cx}" cy="{cy}" rx="{r * 0.45}" ry="{r}" fill="none" stroke="#94a3b8" stroke-width="1"/>')
        self.add(f'<ellipse cx="{cx}" cy="{cy}" rx="{r}" ry="{r * 0.35}" fill="none" stroke="#94a3b8" stroke-width="1"/>')
        self.line(cx - r, cy, cx + r, cy, "#94a3b8", 1)
        # a few "guessed countries" patches, shaded by distance
        for dx, dy, rr, f in ((-0.35, -0.2, 0.2, "#cbd5e1"), (0.2, 0.15, 0.17, "#94a3b8"), (0.05, -0.45, 0.13, "#e2e8f0")):
            self.add(f'<ellipse cx="{cx + dx * r}" cy="{cy + dy * r}" rx="{rr * r}" ry="{rr * r * 0.8}" fill="{f}" stroke="{LINE}" stroke-width="1"/>')

    def note(self, x, y, s, anchor="start"):
        self.text(x, y, s, 10.5, 400, MUTED, anchor, italic=True)

    def callout(self, x, y, n):
        self.circle(x, y, 9, ACCENT, ACCENT, 1)
        self.text(x, y + 4, str(n), 10, 700, "#ffffff", "middle")

    def svg(self):
        body = "\n".join(self.out)
        return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {self.w} {self.h}" width="{self.w}" height="{self.h}" '
                f'font-family="{FONT}"><rect width="{self.w}" height="{self.h}" fill="#ffffff"/>\n{body}\n</svg>\n')


# =====================================================================================
# WEB
# =====================================================================================
def browser(s, x, y, w, h, title, route):
    s.text(x, y - 10, title, 14, 700)
    s.rect(x, y, w, h, rx=8)
    s.rect(x, y, w, 28, fill=SOFT, rx=8)
    s.rect(x, y + 20, w, 8, fill=SOFT, stroke=SOFT, sw=0, rx=0)
    for i in range(3):
        s.circle(x + 16 + i * 14, y + 14, 4, "#cbd5e1", "#94a3b8", 1)
    s.rect(x + 70, y + 6, w - 90, 17, fill=FILL, rx=8, stroke="#cbd5e1", sw=1)
    s.text(x + 80, y + 18, f"https://cop4331-countryguesser.com{route}", 10, 400, MUTED)
    s.line(x, y + 28, x + w, y + 28, LINE, 1)
    return y + 28  # top of content


def web_sheet():
    W, H = 2030, 940
    s = Sheet(W, H, "CountryGuesser: web wireframes", "React + Tailwind, desktop layout. Low fidelity; labels and routes match the built app.")
    cw, ch, gap = 470, 340, 30
    xs = [30 + i * (cw + gap) for i in range(4)]
    y1 = 100

    # 1 Sign in
    t = browser(s, xs[0], y1, cw, ch, "1  Sign in", "/")
    cx = xs[0] + cw / 2
    s.text(cx, t + 38, "COUNTRYGUESSER", 15, 700, anchor="middle")
    s.rect(cx - 125, t + 52, 250, 228, fill=SOFT, rx=8)
    s.rect(cx - 117, t + 62, 116, 26, fill=ACCENT, rx=5); s.text(cx - 59, t + 79, "Sign in", 11, 600, "#fff", "middle")
    s.rect(cx + 1, t + 62, 116, 26, rx=5); s.text(cx + 59, t + 79, "Create account", 11, 600, anchor="middle")
    s.field(cx - 108, t + 112, 216, "Email", "you@example.com")
    s.field(cx - 108, t + 168, 216, "Password", "••••••••")
    s.button(cx - 108, t + 208, 216, "Sign in")
    s.link(cx - 108, t + 262, "Forgot password?")
    s.link(cx + 108, t + 262, "Continue as guest", anchor="end")
    s.note(xs[0] + 12, y1 + ch - 8, "Landing page: sign in or register (required)")

    # 2 Create account
    t = browser(s, xs[1], y1, cw, ch, "2  Create account", "/register")
    cx = xs[1] + cw / 2
    s.rect(cx - 125, t + 18, 250, 268, fill=SOFT, rx=8)
    s.field(cx - 108, t + 42, 100, "First name"); s.field(cx + 8, t + 42, 100, "Last name")
    s.field(cx - 108, t + 94, 216, "Email", "you@example.com")
    s.field(cx - 108, t + 146, 216, "Password", "At least 8 characters")
    s.field(cx - 108, t + 198, 216, "Confirm password")
    s.button(cx - 108, t + 244, 216, "Create account")
    s.note(xs[1] + 12, y1 + ch - 8, "Inline errors; mismatched passwords send no request")

    # 3 Check inbox + verified
    t = browser(s, xs[2], y1, cw, ch, "3  Verify email", "/verify-email?token=…")
    cx = xs[2] + cw / 2
    s.rect(cx - 150, t + 14, 300, 128, fill=SOFT, rx=8)
    s.text(cx, t + 38, "Check your inbox", 14, 700, anchor="middle")
    s.text(cx, t + 58, "We sent a verification link to you@example.com", 10.5, 400, MUTED, "middle")
    s.button(cx - 90, t + 78, 180, "Resend verification email", primary=False, h=28, size=11)
    s.text(cx, t + 128, "After registering, before the first login", 10, 400, MUTED, "middle", italic=True)
    s.rect(cx - 150, t + 156, 140, 124, fill=SOFT, rx=8)
    s.text(cx - 80, t + 180, "Email verified", 12, 700, anchor="middle")
    s.button(cx - 130, t + 200, 100, "Sign in", h=26, size=11)
    s.note(cx - 80, t + 262, "token valid", "middle")
    s.rect(cx + 10, t + 156, 140, 124, fill=SOFT, rx=8)
    s.text(cx + 80, t + 180, "Link invalid or expired", 11, 700, anchor="middle")
    s.link(cx + 80, t + 214, "Request a new link", 10.5, "middle")
    s.note(cx + 80, t + 262, "expired / used", "middle")

    # 4 Forgot + reset
    t = browser(s, xs[3], y1, cw, ch, "4  Forgot / reset password", "/forgot-password   /reset-password")
    cx = xs[3] + cw / 2
    s.rect(cx - 215, t + 16, 205, 266, fill=SOFT, rx=8)
    s.text(cx - 112, t + 40, "Forgot password?", 13, 700, anchor="middle")
    s.field(cx - 200, t + 72, 175, "Email", "you@example.com")
    s.button(cx - 200, t + 120, 175, "Send reset link")
    s.text(cx - 112, t + 176, "Always the same reply,", 10, 400, MUTED, "middle", italic=True)
    s.text(cx - 112, t + 190, "so accounts can't be guessed", 10, 400, MUTED, "middle", italic=True)
    s.rect(cx + 10, t + 16, 205, 266, fill=SOFT, rx=8)
    s.text(cx + 112, t + 40, "Choose a new password", 13, 700, anchor="middle")
    s.field(cx + 25, t + 72, 175, "New password")
    s.field(cx + 25, t + 128, 175, "Confirm password")
    s.button(cx + 25, t + 176, 175, "Reset password")
    s.text(cx + 112, t + 232, "One-time link, expires in 1 hour", 10, 400, MUTED, "middle", italic=True)

    # 5 Game (double width)
    y2 = y1 + ch + 60
    gw, gh = cw * 2 + gap, 430
    t = browser(s, xs[0], y2, gw, gh, "5  Game: guess the mystery country", "/game")
    s.rect(xs[0] + 14, t + 12, gw - 28, 30, fill=SOFT, rx=5)
    s.text(xs[0] + 26, t + 32, "COUNTRYGUESSER", 12, 700)
    s.text(xs[0] + gw / 2, t + 32, "Points: 120", 11, 600, anchor="middle")
    s.button(xs[0] + gw - 250, t + 15, 90, "Leaderboard", primary=False, h=24, size=10.5)
    s.button(xs[0] + gw - 150, t + 15, 40, "?", primary=False, h=24, size=11)
    s.button(xs[0] + gw - 102, t + 15, 78, "Sign out", primary=False, h=24, size=10.5)
    s.globe(xs[0] + 250, t + 215, 140)
    s.text(xs[0] + 250, t + 385, "Rotating globe: guessed countries are colored by distance", 10.5, 400, MUTED, "middle", italic=True)
    rx = xs[0] + 480
    s.text(rx, t + 66, "FIND THE MYSTERY COUNTRY", 12, 700)
    s.text(rx, t + 90, "Your next guess", 11, 600)
    s.rect(rx, t + 98, 330, 30, rx=4); s.text(rx + 8, t + 118, "Search for a country", 11, 400, "#94a3b8")
    s.button(rx + 340, t + 98, 70, "Guess", h=30, size=11)
    s.rect(rx, t + 132, 330, 66, fill=SOFT, rx=4)
    for i, n in enumerate(("France", "Central African Republic", "French Polynesia")):
        s.text(rx + 10, t + 150 + i * 20, n, 11)
    s.note(rx + 340, t + 150, "Server-side partial match", "start")
    s.note(rx + 340, t + 164, "on every keystroke", "start")
    s.text(rx, t + 228, "Guesses left: 7 / 10", 11, 600)
    s.text(rx, t + 254, "Your guesses", 11, 700)
    s.button(rx + 330, t + 238, 80, "Give up", primary=False, h=24, size=10.5)
    for i, (n, d) in enumerate((("Japan", "~9,700 km  ←"), ("Germany", "~880 km  ↗"), ("Spain", "~1,050 km  ↑"))):
        yy = t + 266 + i * 38
        s.rect(rx, yy, 410, 32, fill=["#e2e8f0", "#cbd5e1", "#f1f5f9"][i], rx=4)
        s.text(rx + 10, yy + 21, n, 11, 600)
        s.text(rx + 400, yy + 21, d, 11, 400, anchor="end")
    s.note(rx, t + 392, "Closest guess first; range color matches the globe", "start")

    # 6 Round over + give-up dialog
    x6 = xs[2]
    t = browser(s, x6, y2, cw, gh, "6  Round over / Give up", "/game")
    s.globe(x6 + 235, t + 128, 68)
    s.rect(x6 + 85, t + 14, 300, 36, fill=ACCENT, rx=6)
    s.text(x6 + 235, t + 37, "You found France!  +90 points", 13, 700, "#fff", "middle")
    s.button(x6 + 150, t + 214, 170, "Play again", h=32)
    s.note(x6 + 235, t + 262, "Answer is highlighted green on the globe", "middle")
    s.rect(x6 + 95, t + 276, 280, 100, fill=FILL, rx=8, sw=2)
    s.text(x6 + 235, t + 298, "Give up this round?", 12, 700, anchor="middle")
    s.text(x6 + 235, t + 316, "Ends the round with 0 points and reveals the country.", 9, 400, MUTED, "middle")
    s.button(x6 + 112, t + 334, 120, "Keep guessing", primary=False, h=28, size=10.5)
    s.button(x6 + 240, t + 334, 120, "Give up round", h=28, size=10.5)

    # 7 Leaderboard
    x7 = xs[3]
    t = browser(s, x7, y2, cw, gh, "7  Leaderboard", "/leaderboard")
    s.text(x7 + 24, t + 36, "THE WORLD'S TOP EXPLORERS", 10, 600, MUTED)
    s.text(x7 + 24, t + 58, "Leaderboard", 17, 700)
    s.button(x7 + cw - 130, t + 36, 106, "Back to game", primary=False, h=26, size=10.5)
    s.rect(x7 + 24, t + 78, cw - 48, 26, fill=SOFT, rx=4)
    for lbl, dx, anc in (("Rank", 14, "start"), ("Player", 90, "start"), ("Points", cw - 62, "end")):
        s.text(x7 + 24 + dx, t + 96, lbl, 11, 700, anchor=anc)
    rows = (("1", "Ada Lovelace", "540"), ("2", "Grace Hopper", "480"), ("3", "You  (highlighted)", "320"), ("4", "Alan Turing", "290"), ("5", "Linus T.", "210"))
    for i, (r, n, p) in enumerate(rows):
        yy = t + 110 + i * 40
        s.rect(x7 + 24, yy, cw - 48, 34, fill="#e2e8f0" if i == 2 else FILL, rx=4, stroke="#cbd5e1", sw=1)
        s.text(x7 + 24 + 14, yy + 22, r, 11)
        s.text(x7 + 24 + 90, yy + 22, n, 11, 600 if i == 2 else 400)
        s.text(x7 + 24 + cw - 62, yy + 22, p, 11, anchor="end")
    s.text(x7 + 90, t + 336, "‹ Prev", 11, 400, MUTED)
    s.text(x7 + cw / 2, t + 336, "Page 1 of 3", 11, 400, MUTED, "middle")
    s.text(x7 + cw - 90, t + 336, "Next ›", 11, 400, MUTED, "end")
    s.note(x7 + cw / 2, t + 372, "20 players per page, ranked by total points", "middle")
    return s


# =====================================================================================
# MOBILE
# =====================================================================================
def phone(s, x, y, w, h, title, bar="CountryGuesser"):
    s.text(x, y - 10, title, 14, 700)
    s.rect(x, y, w, h, rx=22, sw=2)
    s.rect(x + w / 2 - 28, y + 8, 56, 6, fill="#cbd5e1", stroke="#cbd5e1", rx=3, sw=0)
    s.text(x + 16, y + 34, "9:41", 10, 600, MUTED)
    return y + 48


def mobile_sheet():
    W, H = 1870, 650
    s = Sheet(W, H, "CountryGuesser: mobile wireframes", "Flutter (Android and iOS), same dark theme and flow as the web app; shown here in light wireframe style.")
    pw, ph, gap = 238, 520, 24
    xs = [30 + i * (pw + gap) for i in range(7)]
    y0 = 110

    # 1 Login
    t = phone(s, xs[0], y0, pw, ph, "1  Log in")
    cx = xs[0] + pw / 2
    s.text(cx, t + 60, "Welcome back", 18, 700, anchor="middle")
    s.text(cx, t + 80, "Log in to keep guessing countries", 10.5, 400, MUTED, "middle")
    s.field(xs[0] + 20, t + 128, pw - 40, "Email", h=34)
    s.field(xs[0] + 20, t + 196, pw - 40, "Password", "••••••••", h=34)
    s.link(xs[0] + pw - 20, t + 250, "Forgot password?", anchor="end")
    s.button(xs[0] + 20, t + 270, pw - 40, "Log In", h=38, size=13)
    s.text(cx, t + 340, "New here?  Sign up", 11, 400, ACCENT, "middle", underline=True)
    s.note(cx, t + 440, "Unverified account (403)", "middle")
    s.note(cx, t + 454, "opens Check your inbox", "middle")

    # 2 Register
    t = phone(s, xs[1], y0, pw, ph, "2  Create account")
    cx = xs[1] + pw / 2
    s.text(cx, t + 48, "Create account", 18, 700, anchor="middle")
    s.text(cx, t + 68, "Sign up to start earning points", 10.5, 400, MUTED, "middle")
    s.field(xs[1] + 20, t + 106, 92, "First name", h=32); s.field(xs[1] + 126, t + 106, 92, "Last name", h=32)
    s.field(xs[1] + 20, t + 168, pw - 40, "Email", h=32)
    s.field(xs[1] + 20, t + 230, pw - 40, "Password", "At least 8 characters", h=32)
    s.field(xs[1] + 20, t + 292, pw - 40, "Confirm password", h=32)
    s.button(xs[1] + 20, t + 348, pw - 40, "Sign Up", h=38, size=13)
    s.text(cx, t + 416, "Already have an account?  Log in", 10.5, 400, ACCENT, "middle", underline=True)

    # 3 Check inbox
    t = phone(s, xs[2], y0, pw, ph, "3  Check your inbox")
    cx = xs[2] + pw / 2
    s.rect(cx - 30, t + 60, 60, 44, fill=SOFT, rx=6); s.line(cx - 30, t + 60, cx, t + 86, LINE, 1.2); s.line(cx + 30, t + 60, cx, t + 86, LINE, 1.2)
    s.text(cx, t + 140, "Check your inbox", 17, 700, anchor="middle")
    s.text(cx, t + 164, "We sent a verification link", 10.5, 400, MUTED, "middle")
    s.text(cx, t + 178, "to you@example.com", 10.5, 400, MUTED, "middle")
    s.button(xs[2] + 20, t + 214, pw - 40, "Resend email", primary=False, h=36, size=12)
    s.link(cx, t + 280, "Back to Log In", 11, "middle")
    s.note(cx, t + 420, "The link opens the web app", "middle")
    s.note(cx, t + 434, "to finish verifying", "middle")

    # 4 Forgot password
    t = phone(s, xs[3], y0, pw, ph, "4  Forgot password")
    cx = xs[3] + pw / 2
    s.text(cx, t + 56, "Forgot password?", 18, 700, anchor="middle")
    s.text(cx, t + 76, "We'll email you a reset link", 10.5, 400, MUTED, "middle")
    s.field(xs[3] + 20, t + 124, pw - 40, "Email", h=34)
    s.button(xs[3] + 20, t + 180, pw - 40, "Send Reset Link", h=38, size=13)
    s.rect(xs[3] + 20, t + 262, pw - 40, 76, fill=SOFT, rx=8)
    s.text(cx, t + 288, "Check your email", 12, 700, anchor="middle")
    s.text(cx, t + 306, "If an account exists for you@example.com,", 9, 400, MUTED, "middle")
    s.text(cx, t + 319, "a reset link is on its way.", 9, 400, MUTED, "middle")
    s.link(cx, t + 372, "Back to Log In", 11, "middle")
    s.note(cx, t + 440, "Reset itself happens on the web page", "middle")

    # 5 Game
    t = phone(s, xs[4], y0, pw, ph, "5  Game")
    s.rect(xs[4] + 10, t - 8, pw - 20, 28, fill=SOFT, rx=5)
    s.text(xs[4] + 20, t + 11, "CountryGuesser", 11, 700)
    s.text(xs[4] + pw - 78, t + 11, "120 pts", 10, 600)
    s.circle(xs[4] + pw - 24, t + 6, 8, FILL); s.text(xs[4] + pw - 24, t + 10, "?", 10, 700, anchor="middle")
    s.globe(xs[4] + pw / 2, t + 98, 70)
    s.field(xs[4] + 16, t + 206, pw - 32, "Country", 'Start typing, e.g. "fra"', h=30, size=10.5)
    s.rect(xs[4] + 16, t + 238, pw - 32, 50, fill=SOFT, rx=4)
    s.text(xs[4] + 26, t + 256, "France", 10.5); s.text(xs[4] + 26, t + 274, "French Polynesia", 10.5)
    s.text(xs[4] + 16, t + 312, "Guesses 3 / 10", 10.5, 600)
    s.button(xs[4] + pw - 90, t + 296, 74, "Give up", primary=False, h=24, size=10)
    for i, (n, d) in enumerate((("Japan", "~9,700 km ←"), ("Germany", "~880 km ↗"))):
        yy = t + 326 + i * 34
        s.rect(xs[4] + 16, yy, pw - 32, 28, fill=["#e2e8f0", "#cbd5e1"][i], rx=4)
        s.text(xs[4] + 26, yy + 18, n, 10.5, 600); s.text(xs[4] + pw - 26, yy + 18, d, 10.5, 400, anchor="end")
    s.note(xs[4] + pw / 2, t + 410, "Enter picks the top suggestion,", "middle")
    s.note(xs[4] + pw / 2, t + 424, "second Enter guesses", "middle")

    # 6 Round over + give up dialog
    t = phone(s, xs[5], y0, pw, ph, "6  Round over / Give up")
    s.globe(xs[5] + pw / 2, t + 84, 60)
    s.rect(xs[5] + 16, t + 160, pw - 32, 50, fill=ACCENT, rx=8)
    s.text(xs[5] + pw / 2, t + 182, "You found France!", 12, 700, "#fff", "middle")
    s.text(xs[5] + pw / 2, t + 198, "+90 points", 11, 400, "#fff", "middle")
    s.button(xs[5] + 16, t + 224, pw - 32, "Play again", h=34, size=12)
    s.rect(xs[5] + 14, t + 290, pw - 28, 130, fill=FILL, rx=10, sw=2)
    s.text(xs[5] + pw / 2, t + 314, "Give up this round?", 12, 700, anchor="middle")
    s.text(xs[5] + pw / 2, t + 334, "You'll see the mystery country and", 9, 400, MUTED, "middle")
    s.text(xs[5] + pw / 2, t + 346, "earn no points for this round.", 9, 400, MUTED, "middle")
    s.button(xs[5] + 24, t + 368, 88, "Keep playing", primary=False, h=28, size=10)
    s.button(xs[5] + pw - 112, t + 368, 88, "Give up", h=28, size=10)

    # 7 Leaderboard
    t = phone(s, xs[6], y0, pw, ph, "7  Leaderboard")
    s.text(xs[6] + 16, t + 12, "‹", 16, 700)
    s.text(xs[6] + 40, t + 10, "TOP PLAYERS", 9.5, 600, MUTED)
    s.text(xs[6] + 40, t + 30, "Leaderboard", 16, 700)
    rows = (("1", "Ada Lovelace", "540"), ("2", "Grace Hopper", "480"), ("3", "You", "320"), ("4", "Alan Turing", "290"), ("5", "Linus T.", "210"), ("6", "Ken T.", "180"))
    for i, (r, n, p) in enumerate(rows):
        yy = t + 54 + i * 42
        s.rect(xs[6] + 14, yy, pw - 28, 36, fill="#e2e8f0" if i == 2 else FILL, rx=5, stroke="#cbd5e1", sw=1)
        s.text(xs[6] + 26, yy + 23, r, 11, 700); s.text(xs[6] + 52, yy + 23, n, 11, 600 if i == 2 else 400)
        s.text(xs[6] + pw - 26, yy + 23, p, 11, anchor="end")
    s.text(xs[6] + pw / 2, t + 330, "‹   Page 1 of 3   ›", 10.5, 400, MUTED, "middle")
    s.note(xs[6] + pw / 2, t + 400, "Current player highlighted;", "middle")
    s.note(xs[6] + pw / 2, t + 414, "20 per page", "middle")
    return s


if __name__ == "__main__":
    here = Path(__file__).parent
    (here / "web.svg").write_text(web_sheet().svg(), encoding="utf-8")
    (here / "mobile.svg").write_text(mobile_sheet().svg(), encoding="utf-8")
    print("wrote web.svg and mobile.svg")
