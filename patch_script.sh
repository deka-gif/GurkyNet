sed -i '/\/\/ Handle Profile Update/,/setSavingProfile(false);  };/c\
  // Handle Profile Update\
  const handleUpdateProfile = async (e: React.FormEvent) => {\
    e.preventDefault();\
    setSavingProfile(true);\
    setErrorMsg(null);\
    setSuccessMsg(null);\
\
    try {\
      const res = await profileService.updateProfile({\
        name,\
        email,\
        phone_number: phone,\
      });\
\
      if (res.success) {\
        setSuccessMsg(res.message || "Profil Anda berhasil diperbarui.");\
        await fetchUser();\
      } else {\
        setErrorMsg(res.message || "Gagal memperbarui profil.");\
      }\
    } catch (err: any) {\
      setErrorMsg(err.message || "Terjadi kesalahan sistem.");\
    } finally {\
      setSavingProfile(false);\
    }\
  };' src/pages/dashboard/ProfilPage.tsx
