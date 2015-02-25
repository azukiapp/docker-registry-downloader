require('source-map-support').install();
import DockerHub from '../../src/docker-hub';

var chai     = require('chai');
var Q        = require('q');
var log      = require('../../src/helpers/logger');
var logError = require('../../src/helpers/error-helper');
Q.onerror    = logError;

describe('Docker Hub API', function() {

  var dockerHub = new DockerHub();

  beforeEach(function() {
    dockerHub.request_options = {
      timeout: 20000,
      maxAttempts: 5,
      retryDelay: 500
    };
  });

  it('should authenticate the user and get the cookies', function(done) {
    //
    // run the tests like that to test auth:
    // DOCKER_USER=user_name DOCKER_PASS=escapade_password gulp test
    //
    var docker_user = process.env.DOCKER_USER;
    var docker_pass = process.env.DOCKER_PASS;

    if(!docker_user || !docker_pass) {
      log.info('    - DOCKER_USER and DOCKER_PASS envs not found. Ignoring this test. (see README)');
      return done();
    }

    Q.spawn(function* () {
      var result = yield dockerHub.auth('azukiapp', docker_user, docker_pass);
      chai.expect(result).to.have.length(2);
      done();
    });
  });

  it('should search for azktcl', function(done) {
    Q.spawn(function* () {
      var result = yield dockerHub.search('azktcl');
      chai.expect(result.results).to.have.length.above(0);
      chai.expect(result.results[0].name).to.equal('azukiapp/azktcl');
      done();
    });
  });

  it('should get endpoind and token', function(done) {
    Q.spawn(function* () {
      var result = yield dockerHub.images('azukiapp', 'azktcl');
      chai.expect(result.namespace).to.equal('azukiapp');
      chai.expect(result.repository).to.equal('azktcl');
      chai.expect(result.endpoint).to.not.be.undefined();
      chai.expect(result.token).to.not.be.undefined();
      done();
    });
  });

});
