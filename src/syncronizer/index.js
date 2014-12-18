var Q  = require('q');
var log = require('../helpers/logger');
var _ = require('lodash');
var prettyBytes = require('pretty-bytes');
var async = require('async');

import DockerHub from '../docker-hub';
import DockerRegistry from '../docker-registry';
import DockerRemote from '../docker-remote';

class Syncronizer {

	constructor() {
    this.dockerHub = new DockerHub();
		this.dockerRegistry = new DockerRegistry();
		this.dockerRemote = new DockerRemote();
  }

  compare(namespace, repository, tag) {
    return new Q.Promise(function (resolve, reject, notify) {
      try {
        Q.spawn(function* () {
          // get endpoint and token from docker hub
          var hubResult = yield this.dockerHub.images(namespace, repository);


          // get endpoint and token from docker hub
          var imageId = yield this.dockerRegistry.getImageIdByTag(hubResult.endpoint,
                                                                  hubResult.token,
                                                                  namespace,
                                                                  repository,
                                                                  tag);

          var registryAncestors = yield this.dockerRegistry.ancestry(hubResult.endpoint,
                                                                     hubResult.token,
                                                                     imageId);

          // get from local docker
          var fullTagName = namespace + '/' + repository + ':' + tag;
          if (namespace === 'library') {
            fullTagName = repository + ':' + tag;
          }
          var imagesFound = yield this.dockerRemote.searchImagesByTag(fullTagName);

          if (!imagesFound || imagesFound.length === 0) {
            //throw new Error('no local images found for ' + fullTagName);
            log.debug('\n\n:: syncronizer - compare - no local image for '+ fullTagName +' ::');
            log.debug(registryAncestors);
            return resolve(registryAncestors);
          }

          var localAncestors = yield this.dockerRemote.anscestors(imagesFound[0].Id);
          var localImageInspectors = _.pluck(localAncestors, 'imageInspect');
          var localIds = _.pluck(localImageInspectors, 'Id');
          var diff = _.difference(registryAncestors, localIds);
          log.debug('\n\n:: syncronizer - compare registryAncestors ::');
          log.debug(registryAncestors);
          log.debug('\n\n:: syncronizer - compare localIds ::');
          log.debug(localIds);
          log.debug('\n\n:: syncronizer - compare diff ::');
          log.debug(diff);
          return resolve(diff);

        }.bind(this));

      } catch(err) {
        reject(err);
      }
    }.bind(this));
  }

  getSizes(namespace, repository, hubResult, layersList) {
    return new Q.Promise(function (resolve, reject, notify) {
      try {
        var allChecks = [];

        for (var i=0; i < layersList.length; i++) {
            var layerID = layersList[i];
            allChecks.push(this.dockerRegistry.downloadImageGetSize(hubResult.endpoint,
                                                                    hubResult.token,
                                                                    layerID));
        }

        async.parallelLimit(allChecks, 10,
        function(err, results) {

          var totalSize = _.reduce(results, function(sum, num) {
            return sum + num;
          });

          log.debug('\n\n:: syncronizer - getSizes ::');
          log.debug('layers:', layersList.length);
          log.debug('total size:', prettyBytes(totalSize));
          return resolve(totalSize);
        });
      } catch(err) {
        reject(err);
      }
    }.bind(this));
  }

  downloadCallback(endpoint, token, outputPath, imageId) {
    return function (callback) {
      Q.spawn(function* () {
        callback(null, yield this.dockerRegistry.prepareLoading(
          endpoint, token, outputPath, imageId));
      }.bind(this));
    }.bind(this);
  }

  loadCallback(endpoint, token, outputPath, imageId) {
    return function (callback) {
      Q.spawn(function* () {
        var result = yield this.dockerRemote.loadImage(outputPath, imageId);
        callback(null, result);
      }.bind(this));
    }.bind(this);
  }

  // endpoint    : docker registry endpoint from dockerhub
  // token       : repository token         from dockerhub
  // outputPath  : local folder to save
  // imageIdList : all IDs to download
  downloadList(endpoint, token, outputPath, imageIdList) {
    return new Q.Promise(function (resolve, reject, notify) {
      try {
        var allDownloads = [];

        for (var i=imageIdList.length-1; i >= 0 ; i--) {
          var layerID = imageIdList[i];
          allDownloads.push(this.downloadCallback(endpoint, token, outputPath, layerID));
        }

        // download
        async.parallelLimit(allDownloads, 6,
          function(err, results) {
            log.info('all download finished');
            log.debug('\n\n:: syncronizer - downloadAndLoadList ::');
            log.debug('outputs:', results);

            resolve(results);
          }
        );
      } catch(err) {
        reject(err);
      }

    }.bind(this));
  }

  loadList(endpoint, token, outputPath, imageIdList) {
    // opts: {
    //   endpoint    : docker registry endpoint from dockerhub
    //   token       : repository token         from dockerhub
    //   outputPath  : local folder to save
    //   imageIdList : all IDs to download
    // }
    return new Q.Promise(function (resolve, reject, notify) {
      try {
        var allLoads = [];

        for (var i=imageIdList.length-1; i >= 0 ; i--) {
          var layerID = imageIdList[i];
          allLoads.push(this.loadCallback(endpoint, token, outputPath, layerID));
        }

        // load
        async.parallelLimit(allLoads, 1,
          function(err, results) {
            log.info('layers loaded');
            log.debug('\n\n:: syncronizer - downloadAndLoadList ::');
            log.debug('outputs:', results);

            return resolve(results);
          }
        );
      } catch(err) {
        reject(err);
      }

    }.bind(this));
  }

  setTags(endpoint, token, namespace, repository) {
    return new Q.Promise(function (resolve, reject, notify) {
      try {
        Q.spawn(function* () {

          var tags = yield this.dockerRegistry.tags(endpoint, token, namespace, repository);
          var results = [];
          for(var name in tags)
          {
              if (tags.hasOwnProperty(name))
              {
                var tagName = name;
                var imageId = tags[name];

                log.debug('\n\n:: syncronizer - setTag - search image ::');
                log.debug(tagName, imageId);
                var result = yield this.dockerRemote.setImageTag(namespace, repository, imageId, tagName);
                results.push(result);
              }
          }

          resolve(results);

        }.bind(this));
      } catch(err) {
        reject(err);
      }
    }.bind(this));

  }

  sync(namespace, repository, tag) {
    return new Q.Promise(function (resolve, reject, notify) {
      try {
        Q.spawn(function* () {

          // compare docker registry with local images
          var layersToDownload = yield this.compare(namespace, repository, tag);


          /* -.-.-.-.-.-.-.-.-.-.-.-.-.-.-.-.-.-.-.-.-.-.-.-.      DEBUG */
            //           ------------------------------------------
            var target = layersToDownload;
            //           ------------------------------------------
            var depth  = 2; var inspectResult=require("util").inspect(target,{showHidden:!0,colors:!0,depth:depth});console.log("\n>>------------------------------------------------------\n  ##  layersToDownload\n  ------------------------------------------------------\n  source: ( "+__filename+" )"+"\n  ------------------------------------------------------\n"+inspectResult+"\n<<------------------------------------------------------\n");
          /* -.-.-.-.-.-.-.-.-.-.-.-.-.-.-.-.-.-.-.-.-.-.-.-. /END-DEBUG */




          resolve(true);

        }.bind(this));
      } catch(err) {
        reject(err);
      }
    }.bind(this));

  }


}

module.exports = {
  __esModule: true,
  get default() { return Syncronizer }
};
