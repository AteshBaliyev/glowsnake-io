# GlowSnake.io (Android & Web)

**Yaradıcı:** Atəş Balıyev | **Baliyews Studio** tərəfindən yaradılmışdır.

Slither.io tərzində, lakin daha inkişaf etmiş, **35 unikal ilan növü və aktiv qabiliyyətlərə**, **6 nadirlik dərəcəsinə (Common -> Divine)**, **5 tematik xəritəyə**, **50% balanslaşdırılmış resurs iqtisadiyyatına**, **Oflayn (80–150 Ağıllı Bot)** və **Onlayn (Socket.io Çoxserverli Şardinq / Firebase)** multiplayer rejimlərinə malik, sırf **Android telefonlar və mobil toxunma ekranları üçün optimizasiya edilmiş** tam funksional 2D oyun.

---

## Əsas Xüsusiyyətlər

### 1. Android və Mobil Toxunma Optimizasiyası
- **Mobil-İlk İnterfeys:** Android telefon ekranları üçün tam uyğunlaşdırılmış (Full-screen, Landscape orientasiya, PWA `manifest.json`, sıfır gecikməli toxunma idarəetməsi).
- **İdarəetmə Rejimləri:**
  - `Arrow mode (recommended!)`: Toxunma və ya barmaq istiqamətini izləyən hamar idarəetmə.
  - `Classic mode`: Barmağın toxunduğu yerə doğru Slither.io tərzində yönlənmə.
  - `Joystick mode`: Ekranda dinamik/fiksasiya olunmuş virtual coystik.
- **Sol / Sağ Əl Seçimi:** İstifadəçinin istəyinə uyğun olaraq Coystik və Sürətlənmə (Boost) düymələrinin yerini dəyişmə imkanı.
- **Double Tap to Boost:** Ekrana cüt toxunaraq sürətlənməni aktivləşdirmə dəstəyi.

### 2. 35 Unikal İlan və Səviyyə Tərəqqisi
- 1-dən 35-ci səviyyəyə qədər sıralı açılan **35 fərqli ilan**.
- 6 Nadirlik pilləsi: `Common` (1-6), `Rare` (7-13), `Epic` (14-20), `Legendary` (21-26), `Mythic` (27-31), `Divine` (32-35).
- Hər ilanın özünəməxsus rəngləri, premium pulları, tacı və **35 fərqli aktiv bacarığı**.
- **Canlı Önizləmə:** İlan kilitli olsa belə onun üzərinə toxunaraq canlı hərəkətini, pullarını və gücünü öncədən izləmək mümkündür.

### 3. Oflayn Rejim (80–150 Daimi AI Botlar)
- Xəritədə hər zaman **80–150 arası ağıllı bot** dövr edir.
- 4 fərqli güc təbəqəsi: `weak` (zəif/yavaş hədəflər), `normal` (orta səviyyə), `strong` (aqressiv qabaqkəsən), `titan` (nəhəng boss ilanlar).
- **Yem Tamahı və Təbii Toqquşmalar:** Xəritəyə böyük yem düşəndə botlar kütləvi şəkildə sürətlənərək həmin yemə hücum edir və bir-birlərinin bədəninə dəyərək təbii döyüş partlayışları yaradırlar.
- **İnsan Kimi Reflekslər:** Botların reaksiya gecikməsi və səhv etmə ehtimalı var, bu da oyunu daha əyləncəli edir.

### 4. Onlayn Rejim (50–60 İlan, Gizli Bot Balansı & 60+ Çoxserverli Şardinq)
- Otaqlarda daimi ~50–60 ilan balansı saxlanılır. Canlı oyunçu az olduqda yerlər təbii adlar daşıyan gizli botlarla tamamlanır (`[BOT]` yazısı yoxdur).
- Canlı insan sayı 60-ı keçdikdə server avtomatik olaraq **İkinci Serveri (`Server #2`, `Server #3`)** açır və yeni oyunçuları növbəti serverə yönləndirir.

### 5. 50% Balans İqtisadiyyatı və Bol Xallar
- Bir ilan məhv olduqda yerə tökülən yemlər həmin ilanın xalının tam **50%-ni** təşkil edir.
- Xəritədə olan yerdəki xalların sayı əvvəlki halından **3 dəfə artırılıb** (5,800+ yer xalı).

### 6. Nailiyyətlər və Çoxdilli Dəstək
- 12 unikal nailiyyət (`Achievements`) və yeni açılan nailiyyətlər üçün xüsusi bildiriş nişanı.
- Oyun susmaya görə **İngilis dilində (`en`)** açılır; Ayarlardan `English`, `Azərbaycan`, `Türkçe`, `Русский` dillərinə keçid mümkündür.

---

## Server və Canlı Multiplayer (RepoCloud VPS)

Oyun birbaşa hazır canlı RepoCloud Ubuntu VPS serverinə qoşulmaq üçün konfiqurasiya olunmuşdur:
- **Canlı Server Domeni:** `https://vps-2613da52.vps.rcld.dev`
- **Server IP:** `5.9.213.161`
- **Port:** `3000`

### RepoCloud VPS Üzərində 1-Kliklə İşə Salma:

1. **RepoCloud Panelindən:**
   - DevOps AI Agent bölməsində **"Resume Chat"** düyməsinə basın.
   - Söhbətə sadəcə bu əmri göndərin:
     ```text
     Deploy the app with docker compose or bash deploy.sh
     ```
2. **Və ya SSH vasitəsilə birbaşa terminalda:**
   ```bash
   ssh root@5.9.213.161
   # Və bu əmri işə salın:
   curl -sSL https://raw.githubusercontent.com/AteshBaliyev/glowsnake-io/main/deploy.sh | bash
   ```

3. **Docker ilə işə salmaq üçün:**
   ```bash
   docker compose up -d --build
   ```

---

## Quraşdırma və İşə Salma (Lokal İnkişaf)

```bash
# Asılılıqları yükləyin
npm install

# İstehsalat yığımını hazırlayın
npm run build

# Canlı serveri işə salın (Port: 3000)
npm start
```

Brauzerdə və ya Android cihazınızda daxil olun: `http://localhost:3000`
