<?php

// Arabic messages for the validation rules this API uses. Anything missing falls back to
// Laravel's English messages.

return [
    'array' => 'لازم :attribute يكون قايمة.',
    'date_format' => ':attribute لازم يكون بالشكل :format.',
    'distinct' => ':attribute متكرر.',
    'email' => 'اكتب :attribute صح.',
    'in' => ':attribute مش من الاختيارات المسموحة.',
    'integer' => 'لازم :attribute يكون رقم صحيح.',
    'max' => [
        'array' => ':attribute: أقصى حاجة :max عنصر.',
        'numeric' => ':attribute: أقصى حاجة :max.',
        'string' => ':attribute: أقصى حاجة :max حرف.',
    ],
    'min' => [
        'array' => ':attribute: على الأقل :min عنصر.',
        'numeric' => ':attribute: على الأقل :min.',
        'string' => ':attribute: على الأقل :min حروف.',
    ],
    'required' => 'لازم تكتب :attribute.',
    'string' => 'لازم :attribute يكون نص.',
    'unique' => ':attribute ده مستخدم قبل كده.',
    'uuid' => ':attribute لازم يكون UUID صحيح.',

    'attributes' => [
        'name' => 'الاسم',
        'email' => 'البريد الإلكتروني',
        'password' => 'كلمة السر',
        'device' => 'اسم الجهاز',
        'shopName' => 'اسم المحل',
        'since' => 'رقم آخر مزامنة',
        'limit' => 'عدد التغييرات',
    ],
];
