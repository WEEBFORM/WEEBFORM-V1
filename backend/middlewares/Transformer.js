const responseTransformer = (req, res, next) => {
    const oldSend = res.send;
  
    res.send = function (data) {
      const transformedResponse = {
        status: 'success',
        data: JSON.parse(data),
        requestTime: req.requestTime,
      };
  
      oldSend.call(this, JSON.stringify(transformedResponse));
    };
  
    next();
  };
  
  export default responseTransformer;
  

