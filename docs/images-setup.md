# Product photos aur Cloudinary setup

Upload ka code admin panel mein pehle se hai. Sirf Cloudinary account aur
photos chahiye, jo tumhare paas se aayenge.

## 1. Cloudinary account (5 minute, phone se ho jata hai)

1. **cloudinary.com** par free account banao.
2. Dashboard par **Cloud name** note karo (Settings ke upar dikhta hai).
3. **Settings → Upload → Upload presets → Add upload preset**
   - Signing mode: **Unsigned** (zaroori)
   - Folder: `skinova` (optional, photos organized rehti hain)
   - Save karke **preset ka naam** note karo.
4. **API Secret kabhi kisi file ya chat mein mat daalo.** Sirf cloud name aur
   unsigned preset name chahiye, dono public-safe hain.

## 2. Admin mein daalo

1. `https://<tumhari-site>/admin` kholo, login karo.
2. **Settings → Images (Cloudinary)**: Cloud name aur Unsigned upload preset paste karo.
3. **Save settings** dabao.

## 3. Product photos upload karo

1. **Products** → product kholo (ya naya banao).
2. Images wale hisse mein file chuno. Ek saath kai photos ho sakti hain.
3. **Pehli photo main photo banti hai** (cards, Google aur share preview mein wahi dikhti hai).
4. Save karo. Storefront ek minute mein update hota hai.

Photos phone se seedhi upload ho sakti hain. Bade photos (4-12 MB) admin khud
2000px tak chhote kar deta hai, kyunke Cloudinary free plan 10 MB se bari image reject karta hai.

## Photo ke tips

- **Square (1:1)** best hai, kam se kam 1000x1000px, saaf background.
- Pehli photo product ki, phir texture / use / packaging.
- Alt text khali ho to product ka naam use hota hai, alag se likhne ki zaroorat nahi.
- Banners (Settings → banners) wide honi chahiye, jaise 1600x600px.
- Logo aur icons `public/icons/` mein files hain; unhe badalna ho to same naam se replace karo.

## Agar upload fail ho

| Message | Wajah |
|---|---|
| "Add your Cloudinary details in Settings first" | Cloud name / preset save nahi hua |
| "Upload preset not found" / "Unknown API key" | Preset ka naam galat ya preset **Unsigned** nahi |
| "Invalid cloud_name" | Cloud name galat (dashboard se copy karo) |
| "File size too large" | Bahut bari file (ye ab kam hona chahiye) |

Storefront mein check: photo `res.cloudinary.com` se aaye aur URL mein `f_auto,q_auto` ho.
