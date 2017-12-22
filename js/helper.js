//Javascript helper file with all functions which help other functions to do their work
const Helper = (function () {
  return {
    //Get the class name for the new quest from the directory name
    getClassNameFromDirectory: function(directory) {
      return 'Add' + directory.replace(/(?:_| |\b)(\w)/g, function(key) {
        return key.toUpperCase()
      }).replace(/_/g, '');
    },
    //Process an image if it has been selected
    processImage: function(file) {
      const reader = new FileReader();
      reader.onload = function(event) {
        let img = new Image();
        img.onload = function() {
          if (img.width != img.height) {
            return Materialize.toast('The selected image is not quadratic. Please select an image with the same width and height!', 6000);
          }
          if (img.width < drawableSizes.xxhdpi || img.height < drawableSizes.xxhdpi) {
            return Materialize.toast('The selected image is smaller than 384*384 pixels. Please select an image which is bigger.', 6000);
          }
          $('#preview-image').html(img);
        }
        img.src = event.target.result;
      }
      if (file != null) reader.readAsDataURL(file);
    },
    //Resize an image to a specified size
    resizeImage: function(data, size) {
      let img = new Image();
      img.src = data;
      let canvas = document.createElement('canvas');
      canvas.width = size;
      canvas.height = size;
      canvas.getContext('2d').drawImage(img, 0, 0, size, size);
      return Helper.dataURItoBlob(canvas.toDataURL('image/jpeg', 0.8), 'image/jpeg');
    },
    //Convert a data URI to blob
    dataURItoBlob: function(dataURI, type) {
      let byteString = atob(dataURI.split(',')[1]);
      let mimeString = dataURI.split(',')[0].split(':')[1].split(';')[0]
      let ab = new ArrayBuffer(byteString.length);
      let ia = new Uint8Array(ab);
      for (let i = 0; i < byteString.length; i++) {
        ia[i] = byteString.charCodeAt(i);
      }
      return new Blob([ab], {
        type: type
      });
    },
    //GET a file from a specified URL (simple request)
    get: function(url, callback) {
      const xhr = new XMLHttpRequest();
      xhr.onreadystatechange = function() {
        if (this.readyState == 4 && this.status == 200) {
          if (typeof callback == 'function') callback(xhr.responseText);
        }
      };
      xhr.open("GET", url, true);
      xhr.send();
    }
  }
})();
