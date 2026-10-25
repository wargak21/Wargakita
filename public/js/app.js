(function () {
  document.addEventListener('click', function (e) {
    var t = e.target.closest('[data-toggle="sidebar"]');
    if (t) document.body.classList.toggle('nav-open');
    var pw = e.target.closest('[data-toggle-password]');
    if (pw) {
      var input = document.getElementById(pw.getAttribute('data-toggle-password'));
      if (input) input.type = input.type === 'password' ? 'text' : 'password';
    }
  });
  document.addEventListener('submit', function (e) {
    var msg = e.target.getAttribute && e.target.getAttribute('data-confirm');
    if (msg && !window.confirm(msg)) e.preventDefault();
  });
  document.addEventListener('change', function (e) {
    var el = e.target;
    if (el.hasAttribute && el.hasAttribute('data-autosubmit') && el.form) el.form.submit();
    if (el.hasAttribute && el.hasAttribute('data-csv-file') && el.files && el.files[0]) {
      var target = document.getElementById(el.getAttribute('data-csv-file'));
      var reader = new FileReader();
      reader.onload = function () { if (target) target.value = reader.result; };
      reader.readAsText(el.files[0]);
    }
  });
})();
