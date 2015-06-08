import h from '../spec_helper';
import Syncronizer from '../../src/syncronizer';
import DockerHub   from '../../src/docker-hub';

var Q        = require('q');
var logError = require('../../src/helpers/error-helper');
Q.onerror    = logError;

var syncronizer = new Syncronizer();

describe('Syncronizer', function() {

  var diffRuby21Layers = [
    '0839cc41437e0b6af99b75118e41f9bb2512a5f5957163e3bea98d3148645ec0',
    'd600f2a44ad04757afc5d9f70ccd5b427c392e175aa97c42da8f34f4076f69b4',
    '3ed0d8d0b22aeaffca08a5b93a8e3802a3c85008137e9ead406bbc4e58510e08',
    'bb471af2f662b43f47a96a10ead6d8bc052f2ad92172651b8bdec486968ce52f',
    'ce3fecb444ac7eaff2b53b87b1c63b879ecd3d8c9c7ca49f2387de4eb28254ee',
    '2f0a763ebc4981326436e82efb2619c61f59ea09a494f4fef2eae4fc3daba69d',
    'b025428b4bd38af69b9214403edbb8ccafbb5131065ec8f42c97cb1d51589282',
    '24b657b21fd69744a6d51f966186bc8da67e8a2214afbd8d58d7bc4fbf6d047e',
    '98a4bbd1aad52951137372ee50c6c95e886b995d5b8f487be0a178510f092448',
    '2b6c3a03a1b706fc523902b27c0ea111e603b7621d9dc4b341956ad71f8f61e8',
    'ea9819f761f174724f5f05712235b2bcf535bd5e05b476286fd5e46864f58768',
    '8f3e5f544a175edaf28ee2f44477dc40cfd15922e1edfcf024761687f705c251',
    'f99c114b8ec17cf509ec78ab7f490fe4cd984098d825cf74e7a0adea849a19dd'
  ];

  it('should compare local and registry layers', function(done) {

    Q.spawn(function* () {
      var namespace = 'library';
      var repository = 'ruby';
      var tag = '2.1';

      // get endpoint and token from docker hub
      var dockerHub = new DockerHub();
      var hubResult = yield dockerHub.images(namespace, repository);

      var result = yield syncronizer.compare(hubResult, tag);
      h.expect(result).to.not.be.undefined;
      done();
    });
  });

  it('should sync only few layers from azukiapp/azktcl:0.0.1', function(done) {
    this.timeout(30000);
    Q.spawn(function* () {

      var namespace  = 'azukiapp';
      var repository = 'azktcl';
      var dockerHub  = new DockerHub();
      var hubResult  = yield dockerHub.images(namespace, repository);

      var tag = '0.0.1';

      // <><> MOCK dockerRemote.anscestors()
      var original = syncronizer.dockerRemote.anscestors;
      syncronizer.dockerRemote.anscestors = function() {
        return new Q.Promise(function (resolve/*, reject, notify*/) {
          resolve(require('../stubs/anscestors').simulate_old_azktcl_0_0_1);
        });
      };

      // check layers
      var result = yield syncronizer.compare(hubResult, tag);

      // <><> UNMOCK dockerRemote.anscestors()
      syncronizer.dockerRemote.anscestors = original;

      h.expect(result).to.have.length(2);
      done();
    });
  });

  it('should sum all sizes', function(done) {
    this.timeout(15000);

    Q.spawn(function* () {

      var namespace = 'library';
      var repository = 'ruby';

      var dockerHub = new DockerHub();
      var hubResult = yield dockerHub.images(namespace, repository);

      var result = yield syncronizer.getSizes(hubResult, diffRuby21Layers);
      h.expect(result).to.not.be.undefined;
      done();
    });
  });

  it('should download several layers', function(done) {
    this.timeout(18000);
    Q.spawn(function* () {

      var dockerHub  = new DockerHub();
      var namespace  = 'azukiapp';
      var repository = 'azktcl';
      var hubResult  = yield dockerHub.images(namespace, repository);
      var imageIdList = [
        'afecd72a72fc2f815aca4e7fd41bfd01f2e5922cd5fb43a04416e7e291a2b120',
        '0f3c5c8028fbab8bd93aec406dcd4dce23296894abcf2ca93bde408348926f65',
        'fcef2eea64366f6dce50892aa457180e5a329eae6b89500881edd944e1b5b1d0',
        '9dfede15b99153dfa84ef64a4be3ce59e04e20f3cbdd7b6c58e2263907c50163',
        'aeae21d102569e871da86fd51ab8fd34ca12031a779ba6d02eea55a7f5123c10',
        '15e0cd32c467ccef1c162ee17601e34aa28de214116bba3d4698594d810a6303',
        'c58121c7a8c81b5848ec10e04029456c71ddd795ccca9c6a281d42ae34c3b73b',
        '511136ea3c5a64f264b78b5433614aec563103b4d4702f3ba7d4d2698e22c158'
      ];

      var result = yield syncronizer.downloadList(
        hubResult,
        __dirname + '/../../../spec/docker-registry/output',
        imageIdList
      );

      h.expect(result).to.not.be.undefined;
      done();
    });
  });

  it('should load several layers', function(done) {
    this.timeout(18000);
    Q.spawn(function* () {

      var dockerHub  = new DockerHub();
      var namespace  = 'azukiapp';
      var repository = 'azktcl';
      var hubResult  = yield dockerHub.images(namespace, repository);
      var imageIdList = [
        'afecd72a72fc2f815aca4e7fd41bfd01f2e5922cd5fb43a04416e7e291a2b120',
        '0f3c5c8028fbab8bd93aec406dcd4dce23296894abcf2ca93bde408348926f65',
        'fcef2eea64366f6dce50892aa457180e5a329eae6b89500881edd944e1b5b1d0',
        '9dfede15b99153dfa84ef64a4be3ce59e04e20f3cbdd7b6c58e2263907c50163',
        'aeae21d102569e871da86fd51ab8fd34ca12031a779ba6d02eea55a7f5123c10',
        '15e0cd32c467ccef1c162ee17601e34aa28de214116bba3d4698594d810a6303',
        'c58121c7a8c81b5848ec10e04029456c71ddd795ccca9c6a281d42ae34c3b73b',
        '511136ea3c5a64f264b78b5433614aec563103b4d4702f3ba7d4d2698e22c158'
      ];

      var result = yield syncronizer.loadList(
        hubResult,
        __dirname + '/../../../spec/docker-registry/output',
        imageIdList
      );

      h.expect(result).to.not.be.undefined;
      done();
    });
  });

  it('should tag local layers', function(done) {
    this.timeout(3000);
    Q.spawn(function* () {

      var dockerHub  = new DockerHub();
      var namespace  = 'azukiapp';
      var repository = 'azktcl';
      var hubResult  = yield dockerHub.images(namespace, repository);
      var result = yield syncronizer.setTags(hubResult);
      h.expect(result).to.not.be.undefined;
      done();
    });
  });

  it('should sync azukiapp/azktcl:0.0.1', function(done) {
    this.timeout(30000);
    Q.spawn(function* () {

      var namespace  = 'azukiapp';
      var repository = 'azktcl';
      var dockerHub  = new DockerHub();
      var hubResult  = yield dockerHub.images(namespace, repository);

      var tag = '0.0.1';
      var outputPath = __dirname + '/../../../spec/docker-registry/output';
      var result = yield syncronizer.sync(hubResult, tag, outputPath);

      h.expect(result).to.not.be.undefined;
      done();
    });
  });

  it('should sync azukiapp/azktcl:0.0.1 on OS temp folder', function(done) {
    this.timeout(30000);
    Q.spawn(function* () {

      var namespace  = 'azukiapp';
      var repository = 'azktcl';
      var dockerHub  = new DockerHub();
      var hubResult  = yield dockerHub.images(namespace, repository);

      var tag = '0.0.1';
      var result = yield syncronizer.sync(hubResult, tag);

      h.expect(result).to.not.be.undefined;
      done();
    });
  });

  describe('compare repos', function() {

    it('should get total size', function(done) {
      this.timeout(15000);

      Q.spawn(function* () {

        var namespace = 'saitodisse';
        var repository = '10mblayers';
        var tag = 'latest';

        var dockerHub = new DockerHub();
        var hubResult = yield dockerHub.images(namespace, repository);

        var layers_to_download = yield syncronizer.getTotalSize(hubResult, tag);

        h.expect(layers_to_download.layersCount).to.not.be.undefined;
        h.expect(layers_to_download.totalSize).to.not.be.undefined;

        done();
      });
    });

    it('should get local total size', function(done) {
      this.timeout(150000);
      var getSize = function() {
        Q.spawn(function* () {

          var total_local_size = yield syncronizer.getTotalLocalSize({
            namespace : 'saitodisse',
            repository: '10mblayers'
          }, 'latest');

          done();
          return total_local_size;
        });
      };

      getSize();

    });

    it('should get null when check an invalid local layer', function(done) {
      Q.spawn(function* () {
        var result = yield syncronizer.checkLocalLayer('invalid_layer_id');
        h.expect(result).to.be.null;
        done();
      });
    });

    it('should get diff from registry and local layers', function(done) {
      Q.spawn(function* () {

        var namespace = 'saitodisse';
        var repository = '10mblayers';
        var tag = 'latest';

        var dockerHub = new DockerHub();
        var hubResult = yield dockerHub.images(namespace, repository);

        var result = yield syncronizer.getLayersDiff(hubResult, tag);

        h.expect(result).to.not.be.undefined;
        done();
      });
    });

    it('should check size of local all selected layers', function(done) {
      Q.spawn(function* () {

        var local_layers_to_check = [ 'e8f08a5f551055074246712d662a570dd0c77267431179e6be4d67cd982c0e45',
          'beadc5a63bb040b3db1aaaca341dc671e4a6c2d4e8225922547810ba7cc09c5b',
          '1c214b1b0e353a5bbed75f3e1f03be1a21303a9101b389b21a7a8bfd76b15ee7',
          '5398df0552f4166b34f15b80be815f1c02a273aea76247a2c191bfb392607251',
          'a40834ae7d4a274424415e0184ab4fe89316124cb935e59e2060aa353b64f747',
          'd5e54a7e17cfc43779546691c7fceb58fc28b76294614dfe00dbc6a6ee34c27c',
          'f699ea6fa8cd39b53da7f661248671ba02b07e8e95c4bead9b01da6d7e248a4b',
          '7f7125e08aadb6adb4a41b67b2a33d4571143cd05d24b734a571272a8e303f66',
          'e1debeaf628b547cd05a5e7ee6f49669926fd34d63d4ed6465259300cd5130d0',
          '437e87c05d0e4b63d98a2a291d6b4fc0ee40a85b676851b8254791b77597a826' ];

        var result = yield syncronizer.checkTotalLocalSizes(local_layers_to_check);

        h.expect(result).to.not.be.undefined;
        done();
      });
    });

    it('should count local layers', function(done) {
      Q.spawn(function* () {

        var local_layers_to_check = [ 'e8f08a5f551055074246712d662a570dd0c77267431179e6be4d67cd982c0e45',
          'beadc5a63bb040b3db1aaaca341dc671e4a6c2d4e8225922547810ba7cc09c5b',
          '1c214b1b0e353a5bbed75f3e1f03be1a21303a9101b389b21a7a8bfd76b15ee7',
          '5398df0552f4166b34f15b80be815f1c02a273aea76247a2c191bfb392607251',
          'a40834ae7d4a274424415e0184ab4fe89316124cb935e59e2060aa353b64f747',
          'd5e54a7e17cfc43779546691c7fceb58fc28b76294614dfe00dbc6a6ee34c27c',
          'f699ea6fa8cd39b53da7f661248671ba02b07e8e95c4bead9b01da6d7e248a4b',
          '7f7125e08aadb6adb4a41b67b2a33d4571143cd05d24b734a571272a8e303f66',
          'e1debeaf628b547cd05a5e7ee6f49669926fd34d63d4ed6465259300cd5130d0',
          '437e87c05d0e4b63d98a2a291d6b4fc0ee40a85b676851b8254791b77597a826' ];

        var result = yield syncronizer.checkTotalLocalCount(local_layers_to_check);

        h.expect(result).to.not.be.undefined;
        done();
      });
    });
  });
});
