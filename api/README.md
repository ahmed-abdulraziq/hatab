# HATAB API

API بـ Laravel 13 للحسابات والمزامنة. صاحب المحل يعمل حساب، والبرنامج على كل موبايل أو كمبيوتر بيبعت التغييرات اللي حصلت عليه وياخد اللي حصل على الأجهزة التانية.

البرنامج نفسه بيفضل شغال من غير نت زي ما هو. المزامنة بتحصل لما النت يرجع، والسيرفر مكان بيتجمع فيه الدفتر من كل الأجهزة، ونسخة احتياطية في نفس الوقت.

## التشغيل

محتاج PHP 8.3 أو أحدث، وComposer.

```bash
cd api
composer install
cp .env.example .env
php artisan key:generate
touch database/database.sqlite
php artisan migrate
php artisan serve          # على http://localhost:8000
php artisan test           # الاختبارات
```

قاعدة البيانات SQLite افتراضيًا، فمش محتاج سيرفر. لو هتستخدم MySQL أو PostgreSQL غيّر `DB_*` في `.env`.

## الطلبات

كل الطلبات والردود JSON، وكلها تحت `/api/v1`. الطلبات اللي محتاجة دخول بتتبعت بالـ token اللي راجع من التسجيل أو الدخول:

```
Authorization: Bearer <token>
```

| الطلب | محتاج دخول | الوظيفة |
| --- | --- | --- |
| `POST /register` | لأ | حساب جديد. بياخد `name` و`email` و`password` (8 حروف على الأقل) و`device` (اختياري) |
| `POST /login` | لأ | دخول من جهاز. بياخد `email` و`password` و`device` (اختياري) |
| `POST /logout` | أيوه | خروج الجهاز ده بس، والأجهزة التانية بتفضل داخلة |
| `GET /me` | أيوه | بيانات الحساب |
| `PATCH /me` | أيوه | تعديل `name` أو `shopName` |
| `POST /sync` | أيوه | المزامنة (تحت) |

التسجيل والدخول بيرجّعوا:

```json
{
  "token": "1|Xb3...",
  "user": { "id": 1, "name": "أحمد", "email": "ahmed@example.com", "shopName": "" }
}
```

### الأخطاء

| الكود | المعنى |
| --- | --- |
| `401` | مفيش token أو الـ token اتلغى |
| `422` | بيانات غلط. الرسايل بالعربي في `errors`، زي `{"errors": {"email": ["البريد الإلكتروني ده مستخدم قبل كده."]}}` |
| `429` | محاولات كتير. التسجيل والدخول ليهم 10 محاولات في الدقيقة، وباقي الطلبات 120 |

## المزامنة: `POST /api/v1/sync`

الجهاز بيبعت في نفس الطلب حاجتين: التغييرات اللي حصلت عليه من آخر مزامنة، ورقم آخر تغيير شافه من السيرفر (`since`). السيرفر بيحفظ تغييرات الجهاز، ويرجّعله كل اللي اتغيّر بعد الرقم ده.

```json
{
  "since": 0,
  "clients": [
    {
      "id": "7c9e6679-7425-40de-944b-e07fc1f90ae7",
      "name": "أحمد علي",
      "phone": "01012345678",
      "address": "",
      "createdAt": "2026-11-05T10:00:00.000Z",
      "updatedAt": "2026-11-05T10:00:00.000Z",
      "deletedAt": null
    }
  ],
  "transactions": [
    {
      "id": "0f8fad5b-d9cb-469f-a165-70867728950e",
      "clientId": "7c9e6679-7425-40de-944b-e07fc1f90ae7",
      "type": "gave",
      "amount": 15000,
      "date": "2026-11-05",
      "note": "2 كيلو سكر",
      "createdAt": "2026-11-05T10:00:00.000Z",
      "updatedAt": "2026-11-05T10:00:00.000Z",
      "deletedAt": null
    }
  ]
}
```

الرد:

```json
{
  "revision": 2,
  "hasMore": false,
  "clients": [ ... ],
  "transactions": [ ... ],
  "rejected": []
}
```

**قواعد المزامنة:**

- **شكل البيانات:** السجلات بنفس الشكل اللي البرنامج بيحفظه على الجهاز:
  - الـ `id` بيتعمل على الجهاز (UUID).
  - `amount` بالقرش كرقم صحيح.
  - `type` قيمته `gave` (إديته) أو `got` (خدت منه).
  - التواريخ بتوقيت UTC وفيها الملّي ثانية.
- **التعديل الأحدث بيكسب:** لو السجل موجود على السيرفر، بيتحدّث بس لو `updatedAt` اللي جاي أحدث من اللي متخزن.
- **المسح:** بيتبعت كسجل عادي فيه `deletedAt`. السيرفر بيحتفظ بيه عشان المسح يوصل للأجهزة التانية.
- **رقم التغيير:** كل حساب ليه رقم تغيير واحد بيزيد مع كل حفظ، للعملاء والحركات مع بعض. الجهاز بيحفظ `revision` اللي راجع ويبعته `since` في المزامنة الجاية، فمفيش تغيير بيتنسي أو بيتكرر.
- **الصفحات:** لو `hasMore` قيمته `true`، الجهاز يطلب تاني بالـ `revision` الجديد لحد ما تبقى `false`. أقصى حاجة 500 سجل في الصفحة، وتقدر تقلّلها بـ `limit`، وأقصى حاجة 500 سجل من كل نوع في الطلب الواحد.
- **السجلات المرفوضة:** بتيجي في `rejected` ومعاها السبب، وباقي الطلب بيتحفظ عادي:
  - `not_yours`: الـ id تبع حساب تاني.
  - `unknown_client`: الحركة بتشاور على عميل مش موجود في الحساب ده.
- **مزامنة واحدة في نفس الوقت:** لو جهازين عملوا مزامنة مع بعض في نفس اللحظة، بياخدوا دور. الحساب بيتقفل لحد ما الطلب يخلص.

## الإعدادات المهمة في `.env`

| المتغير | الوظيفة |
| --- | --- |
| `APP_KEY` | بيتعمل بـ `php artisan key:generate` |
| `APP_ENV` و`APP_DEBUG` | على السيرفر الحقيقي: `production` و`false` |
| `DB_*` | قاعدة البيانات |
| `CORS_ALLOWED_ORIGINS` | المواقع المسموح لها تكلّم الـ API، مفصولة بفاصلة. الافتراضي هو GitHub Pages بتاع البرنامج وlocalhost |

## الرفع على Railway

1. **ادمج PR الـ API في `main`.** Railway هياخد الكود من هناك.
2. **اعمل مشروع:** على [railway.com](https://railway.com) اختار **New Project ← Deploy from GitHub repo**، واختار الريبو `hatab`. لو Railway لسه ملوش صلاحية على GitHub بتاعك، هيطلب منك تديله.
3. **فولدر الـ API:** افتح الخدمة الجديدة، وفي **Settings ← Source** خلّي **Root Directory** يبقى `/api`، لأن الـ API مش في أول الريبو.
4. **قاعدة البيانات:** من صفحة المشروع اختار **Create ← Database ← PostgreSQL**.
5. **المتغيرات:** في **Variables** بتاعة خدمة الـ API افتح **Raw Editor** والصق ده:

   ```
   APP_NAME=HATAB
   APP_ENV=production
   APP_DEBUG=false
   APP_KEY=
   APP_LOCALE=ar
   APP_FALLBACK_LOCALE=en
   DB_CONNECTION=pgsql
   DB_URL=${{Postgres.DATABASE_URL}}
   SESSION_DRIVER=array
   CACHE_STORE=database
   QUEUE_CONNECTION=sync
   LOG_CHANNEL=stderr
   ```

   - **`APP_KEY`:** حط فيه مفتاح عشوائي تعمله على جهازك بأمر من دول، وما تشاركهوش مع حد:
     - على Mac أو Linux: `echo "base64:$(openssl rand -base64 32)"`
     - على Windows من PowerShell 7: `"base64:" + [Convert]::ToBase64String([Security.Cryptography.RandomNumberGenerator]::GetBytes(32))`
     - لو عندك PHP: `php artisan key:generate --show`
   - **`APP_LOCALE=ar`:** مهم عشان رسايل الأخطاء تطلع بالعربي.
   - **`DB_URL`:** بيوصّل الـ API بقاعدة Postgres اللي عملتها جوه Railway. لو سمّيت خدمة قاعدة البيانات اسم غير `Postgres`، غيّره في السطر.
6. **تحديث قاعدة البيانات مع كل نسخة:** في **Settings ← Deploy ← Pre-Deploy Command** اكتب:

   ```
   sh ./railway/init-app.sh
   ```

   السكريبت ده بيشغّل `php artisan migrate --force` قبل ما النسخة الجديدة تشتغل، ولو فشل النسخة القديمة بتفضل شغالة.
7. **فحص الصحة:** في **Settings ← Deploy** خلّي **Healthcheck Path** يبقى `/up`.
8. **العنوان:** في **Settings ← Networking** دوس **Generate Domain**. هيديك عنوان زي `https://hatab-api-production.up.railway.app`.
9. **اتأكد إنه شغال:** افتح `<العنوان>/up` لازم يظهر إن السيرفر شغال، و`<العنوان>/` لازم يرجّع `{"name":"HATAB API",...}`.
10. **اربط البرنامج بيه:** في GitHub افتح **Settings ← Secrets and variables ← Actions ← Variables**، واعمل متغيّر اسمه `HATAB_API_URL` وقيمته العنوان من غير `/` في الآخر. بعدها من **Actions ← Deploy to GitHub Pages ← Run workflow** اعمل نشر جديد للبرنامج، عشان العنوان يبقى مكتوب جاهز في الإعدادات.

بعد كده كل push على `main` بيرفع نسخة جديدة على Railway لوحده.

**لو حاجة ما اشتغلتش:** افتح **Deployments** وبعدين لوج النسخة اللي فشلت.

| اللي هتشوفه في اللوج | السبب والحل |
| --- | --- |
| `could not find driver` | الـ PHP اللي على Railway ناقصه إضافة Postgres. ابعت اللوج وأنا أظبطها |
| `No application encryption key` | `APP_KEY` فاضي أو مكتوب غلط |
| رسايل الأخطاء بالإنجليزي | `APP_LOCALE=ar` مش مكتوب |
| البرنامج بيقول «مش قادرين نوصل للسيرفر» | العنوان غلط، أو البرنامج مفتوح من عنوان مش موجود في `CORS_ALLOWED_ORIGINS`. الافتراضي بيسمح بـ `https://ahmed-abdulraziq.github.io` |

### أي سيرفر تاني

أي استضافة فيها PHP 8.3 وقاعدة بيانات بتنفع. على الاستضافة المشتركة لازم الـ document root يشاور على `api/public`، والملف `public/.htaccess` جاهز. بعد الرفع:

```bash
composer install --no-dev --optimize-autoloader
php artisan migrate --force
php artisan config:cache
php artisan route:cache
```

## الاختبارات على GitHub

`.github/workflows/api.yml` بيشغّل `php artisan test` مع كل تغيير في `api/`.
