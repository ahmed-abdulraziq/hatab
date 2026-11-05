import { Component } from 'react';

// Dexie and the browser use these names when the device won't let the app store data
// (private browsing in some browsers, "block all site data", storage full...).
const STORAGE_ERRORS = /OpenFailed|DatabaseClosed|MissingAPI|InvalidState|Security|QuotaExceeded|Abort/;

function isStorageError(error) {
  return STORAGE_ERRORS.test(error?.name ?? '') || STORAGE_ERRORS.test(error?.inner?.name ?? '');
}

/** Shows a message (instead of a blank page) when something breaks while rendering. */
export default class ErrorBoundary extends Component {
  state = { error: null };

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error('HATAB stopped because of an error', error, info?.componentStack);
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    const storage = isStorageError(error);
    return (
      <main className="crash" role="alert">
        <h1 className="crash-title">{storage ? 'المتصفح ده مش سامح بحفظ البيانات' : 'حصلت مشكلة والبرنامج وقف'}</h1>
        <p className="crash-text">
          {storage
            ? 'البرنامج بيحفظ حساباتك على الجهاز نفسه، والمتصفح ده مانع ده. افتحه من Chrome أو Safari في الوضع العادي (مش الوضع الخاص)، واتأكد إن حفظ بيانات المواقع مش مقفول من الإعدادات.'
            : 'بياناتك متسجلة على الجهاز ومش هتضيع. افتح البرنامج تاني، ولو المشكلة اتكررت ابعت صورة من التفاصيل اللي تحت.'}
        </p>
        <button type="button" className="btn btn--primary" onClick={() => window.location.reload()}>
          افتح البرنامج تاني
        </button>
        <details className="crash-details">
          <summary>تفاصيل المشكلة</summary>
          <pre dir="ltr">{`${error?.name ?? 'Error'}: ${error?.message ?? String(error)}\n${navigator.userAgent}`}</pre>
        </details>
      </main>
    );
  }
}
