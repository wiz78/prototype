
suite('Base', function () {

  this.name = 'base';

  test('Browser detection', function () {

    var results = $H(Prototype.Browser).map(function (engine) {
      return engine;
    }).partition(function (engine) {
      return engine[1] === true;
    });
    var trues = results[0], falses = results[1];

    info('User agent string is: ' + navigator.userAgent);

    // we should have definite trues or falses here
    trues.each(function(result) {
      assert(result[1] === true);
    }, this);
    falses.each(function(result) {
      assert(result[1] === false);
    }, this);

    var ua = navigator.userAgent;

    if (ua.indexOf('AppleWebKit/') > -1) {
      info('Running on WebKit');
      assert(Prototype.Browser.WebKit);
    }
  });

});